import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContext } from '../context/request-context';
import type { AuthUser } from '../../auth/strategies/jwt.strategy';

/**
 * Binds the authenticated caller's tenancy context into AsyncLocalStorage so
 * downstream services (notably PrismaService middleware) can auto-scope
 * queries by hospitalId.
 *
 * Runs AFTER JwtAuthGuard populates request.user.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;

    RequestContext.set({
      userId: user?.id ?? null,
      role: user?.role ?? null,
      hospitalId: user?.hospitalId ?? null,
      cityId: user?.cityId ?? null,
    });

    return next.handle();
  }
}
