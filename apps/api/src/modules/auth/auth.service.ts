import {
  Injectable, UnauthorizedException, BadRequestException,
  Logger, ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import type { User } from '@prisma/client';

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    if (!user || !user.isActive) return null;

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await this.recordFailedLogin(user.id);
      return null;
    }

    // Reset failed attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastLoginAt: new Date() },
    });

    return user;
  }

  async login(user: User): Promise<{ user: object; accessToken: string; refreshToken: string; mfaRequired?: boolean }> {
    if (user.mfaEnabled) {
      // Issue short-lived MFA token
      const mfaToken = this.jwtService.sign(
        { sub: user.id, phase: 'mfa' },
        { expiresIn: '5m' },
      );
      return { user: this.sanitizeUser(user), accessToken: '', refreshToken: '', mfaRequired: true, ...{ mfaToken } };
    }

    const tokens = await this.generateTokens(user);
    await this.createSession(user.id, tokens.refreshToken);

    this.logger.log(`User ${user.email} logged in successfully`);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async verifyMFA(userId: string, otp: string): Promise<{ user: object } & AuthTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.mfaSecret) throw new BadRequestException('MFA not configured');

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: otp,
      window: 1,
    });

    if (!isValid) throw new UnauthorizedException('Invalid OTP code');

    const tokens = await this.generateTokens(user);
    await this.createSession(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });

      const session = await this.prisma.userSession.findFirst({
        where: {
          userId: payload.sub,
          refreshToken: await bcrypt.hash(refreshToken, 6),
          expiresAt: { gt: new Date() },
          isRevoked: false,
        },
      });

      if (!session) throw new UnauthorizedException('Invalid or expired refresh token');

      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
      const tokens = await this.generateTokens(user);

      // Rotate refresh token
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: {
          refreshToken: await bcrypt.hash(tokens.refreshToken, 6),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
    this.logger.log(`User ${userId} logged out`);
  }

  async setupMFA(userId: string): Promise<{ qrCode: string; secret: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const secret = speakeasy.generateSecret({
      name: `INDUSTRY360 MES (${user.email})`,
      length: 32,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 },
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
    return { qrCode, secret: secret.base32 };
  }

  async enableMFA(userId: string, otp: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret) throw new BadRequestException('MFA setup not initiated');

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: otp,
      window: 1,
    });

    if (!isValid) throw new BadRequestException('Invalid OTP - please try again');

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) throw new BadRequestException('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
      },
    });

    // Revoke all sessions on password change
    await this.prisma.userSession.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }

  private async generateTokens(user: User): Promise<AuthTokens> {
    const permissions = await this.getUserPermissions(user.id);

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      permissions,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.config.get<string>('jwt.expiresIn', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async createSession(userId: string, refreshToken: string): Promise<void> {
    const hashedToken = await bcrypt.hash(refreshToken, 6);
    await this.prisma.userSession.create({
      data: {
        userId,
        refreshToken: hashedToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Clean old sessions
    await this.prisma.userSession.deleteMany({
      where: {
        userId,
        OR: [{ expiresAt: { lt: new Date() } }, { isRevoked: true }],
      },
    });
  }

  private async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
    return user?.rolePermissions.map((rp) => rp.permission.code) ?? [];
  }

  private async recordFailedLogin(userId: string): Promise<void> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });

    if (user.failedLoginAttempts >= 5) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isActive: false, lockedAt: new Date() },
      });
      this.logger.warn(`Account locked for user ${userId} after 5 failed attempts`);
    }
  }

  sanitizeUser(user: User) {
    const { passwordHash, mfaSecret, ...safeUser } = user;
    return safeUser;
  }
}
