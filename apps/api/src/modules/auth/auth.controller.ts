import {
  Controller, Post, Get, Body, UseGuards, Request,
  HttpCode, HttpStatus, Patch, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyMFADto } from './dto/verify-mfa.dto';
import type { User } from '@prisma/client';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'User login', description: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify MFA OTP' })
  async verifyMFA(@Body() dto: VerifyMFADto) {
    if (!dto.userId) throw new UnauthorizedException('userId required for MFA verification');
    return this.authService.verifyMFA(dto.userId, dto.otp);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout and revoke tokens' })
  @AuditLog('AUTH_LOGOUT')
  async logout(@CurrentUser() user: User, @Body() dto: RefreshTokenDto) {
    await this.authService.logout(user.id, dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: User) {
    return this.authService.sanitizeUser(user);
  }

  @Get('mfa/setup')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Initiate MFA setup - returns QR code' })
  async setupMFA(@CurrentUser() user: User) {
    return this.authService.setupMFA(user.id);
  }

  @Post('mfa/enable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Enable MFA after verifying OTP' })
  async enableMFA(@CurrentUser() user: User, @Body() dto: VerifyMFADto) {
    await this.authService.enableMFA(user.id, dto.otp);
    return { message: 'MFA enabled successfully' };
  }

  @Patch('change-password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change user password' })
  @AuditLog('AUTH_PASSWORD_CHANGE')
  async changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { message: 'Password changed successfully' };
  }
}
