import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_LOG_KEY } from '../decorators/audit-log.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  constructor(private readonly reflector?: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector?.getAllAndOverride<string>(AUDIT_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!action) return next.handle();

    const request = context.switchToHttp().getRequest<{
      user?: { id: string; email: string };
      ip: string;
      method: string;
      url: string;
    }>();
    const user = request.user;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(
          JSON.stringify({
            action,
            userId: user?.id,
            userEmail: user?.email,
            ip: request.ip,
            method: request.method,
            url: request.url,
            duration,
            timestamp: new Date().toISOString(),
          }),
        );
      }),
    );
  }
}
