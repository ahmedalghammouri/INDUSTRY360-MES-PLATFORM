import {
  Injectable, UnauthorizedException, BadRequestException, Logger, ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../database/prisma.service';
import type { User } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  enterpriseId: string;
  factoryId: string | null;
  factoryCode: string | null;
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
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Validates credentials — factoryCode optional (SUPER_ADMIN can omit or specify any)
  async validateUser(email: string, password: string, factoryCode?: string): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    if (!user || !user.isActive) return null;

    // Check account lock
    if (user.lockedAt) {
      const lockDuration = 30 * 60 * 1000; // 30 minutes
      if (new Date().getTime() - user.lockedAt.getTime() < lockDuration) {
        return null;
      }
      // Auto-unlock after 30 min
      await this.prisma.user.update({ where: { id: user.id }, data: { lockedAt: null, failedLoginAttempts: 0 } });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await this.recordFailedLogin(user.id);
      return null;
    }

    // Factory validation — non-SUPER_ADMIN must belong to the requested factory
    if (factoryCode && user.role !== 'SUPER_ADMIN') {
      const factory = await this.prisma.factory.findUnique({ where: { code: factoryCode.toUpperCase() } });
      if (!factory || user.factoryId !== factory.id) {
        this.logger.warn(`User ${email} attempted login to factory ${factoryCode} but is assigned elsewhere`);
        return null;
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastLoginAt: new Date() },
    });

    return user;
  }

  async login(
    user: User,
    factoryCode?: string,
  ): Promise<{ user: object; accessToken: string; refreshToken: string }> {
    // Determine effective factory for this session
    let effectiveFactoryId: string | null = user.factoryId;
    let effectiveFactoryCode: string | null = null;

    if (factoryCode) {
      const factory = await this.prisma.factory.findUnique({ where: { code: factoryCode.toUpperCase() } });
      if (factory) {
        effectiveFactoryId = factory.id;
        effectiveFactoryCode = factory.code;
      }
    } else if (user.factoryId) {
      const factory = await this.prisma.factory.findUnique({ where: { id: user.factoryId } });
      effectiveFactoryCode = factory?.code ?? null;
    }

    // SUPER_ADMIN without factoryCode → no factory context (sees enterprise dashboard)
    if (user.role === 'SUPER_ADMIN' && !effectiveFactoryCode) {
      effectiveFactoryId = null;
    }

    const tokens = await this.generateTokens(user, effectiveFactoryId, effectiveFactoryCode);
    await this.createSession(user.id, tokens.refreshToken, effectiveFactoryId);

    this.logger.log(`User ${user.email} logged in (factory: ${effectiveFactoryCode ?? 'all'})`);

    // Return enriched user profile with factory info
    const userWithFactory = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { factory: true, enterprise: true },
    });

    return {
      user: this.sanitizeUser(userWithFactory!),
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens & { user: object }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });

      const sessions = await this.prisma.userSession.findMany({
        where: { userId: payload.sub, expiresAt: { gt: new Date() }, isRevoked: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      // Verify token hash against stored sessions
      let validSession: typeof sessions[0] | null = null;
      for (const session of sessions) {
        const match = await bcrypt.compare(refreshToken, session.refreshToken);
        if (match) { validSession = session; break; }
      }

      if (!validSession) throw new UnauthorizedException('Invalid or expired refresh token');

      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: payload.sub },
        include: { factory: true, enterprise: true },
      });

      const tokens = await this.generateTokens(user, payload.factoryId, payload.factoryCode);

      // Rotate refresh token
      await this.prisma.userSession.update({
        where: { id: validSession.id },
        data: {
          refreshToken: await bcrypt.hash(tokens.refreshToken, 6),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return { user: this.sanitizeUser(user), ...tokens };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
    this.logger.log(`User ${userId} logged out`);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) throw new BadRequestException('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, passwordChangedAt: new Date() },
    });

    await this.prisma.userSession.updateMany({ where: { userId }, data: { isRevoked: true } });
  }

  // Returns list of factories available for login (for factory selector population)
  async getFactoriesForSelector(): Promise<Array<{
    id: string; code: string; name: string; nameAr: string | null;
    city: string | null; lat: number | null; lng: number | null;
    color: string; glowColor: string; isActive: boolean;
  }>> {
    return this.prisma.factory.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, nameAr: true, city: true, lat: true, lng: true, color: true, glowColor: true, isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  private async generateTokens(
    user: User,
    factoryId: string | null,
    factoryCode: string | null,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      enterpriseId: user.enterpriseId,
      factoryId,
      factoryCode,
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

  private async createSession(userId: string, refreshToken: string, factoryId?: string | null): Promise<void> {
    const hashedToken = await bcrypt.hash(refreshToken, 6);
    await this.prisma.userSession.create({
      data: {
        userId,
        refreshToken: hashedToken,
        factoryId: factoryId ?? null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Clean expired / revoked sessions
    await this.prisma.userSession.deleteMany({
      where: {
        userId,
        OR: [{ expiresAt: { lt: new Date() } }, { isRevoked: true }],
      },
    });
  }

  private async recordFailedLogin(userId: string): Promise<void> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });

    if (user.failedLoginAttempts >= 5) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedAt: new Date() },
      });
      this.logger.warn(`Account locked for user ${userId} after 5 failed attempts`);
    }
  }

  sanitizeUser(user: any) {
    const { passwordHash, mfaSecret, ...safeUser } = user;
    return safeUser;
  }
}
