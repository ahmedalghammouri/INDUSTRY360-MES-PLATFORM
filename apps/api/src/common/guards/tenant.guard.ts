import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { tenantId: string };
      headers: Record<string, string>;
      tenantId?: string;
    }>();
    const user = request.user;
    if (!user) return true;

    const tenantId = user.tenantId || request.headers['x-tenant-id'];
    request.tenantId = tenantId;

    return true;
  }
}
