import {
  Controller, Post, Get, Body, UseGuards, Request,
  HttpCode, HttpStatus, Patch, UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { User } from '@prisma/client';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Returns all active factories for the factory selector landing page
  @Public()
  @Get('factories')
  @ApiOperation({ summary: 'Get all factories for the selector map', description: 'Returns factory list with coordinates and branding for the landing map page.' })
  async getFactories() {
    return this.authService.getFactoriesForSelector();
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Factory-scoped user login', description: 'Authenticate with email, password, and optional factoryCode. JWT will contain factoryId for tenant isolation.' })
  @ApiResponse({ status: 200, description: 'Login successful — returns user profile + access + refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or factory mismatch' })
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.email, dto.password, dto.factoryCode);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.authService.login(user, dto.factoryCode);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout and revoke all sessions' })
  async logout(@CurrentUser() user: User) {
    await this.authService.logout(user.id);
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getProfile(@CurrentUser() user: any) {
    return this.authService.sanitizeUser(user);
  }

  @Patch('change-password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change user password' })
  async changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { message: 'Password changed successfully' };
  }
}
