import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../../auth/strategies/jwt.strategy';

/**
 * Ensures the authenticated caller has a hospital scope (non-null hospitalId).
 * Attach via `@UseGuards(HospitalScopeGuard)` on controllers/endpoints that
 * must operate within a single hospital (creates/updates that need a
 * hospitalId to persist).
 *
 * SUPER_ADMIN / MINISTRY_ADMIN / REGIONAL_ADMIN roles have hospitalId=null and
 * will be rejected here. Those roles should use explicit cross-hospital
 * endpoints or pass a target hospitalId in the request body.
 */
@Injectable()
export class HospitalScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser }>();
    const user = req.user;

    if (!user || !user.hospitalId) {
      throw new ForbiddenException(
        'This endpoint requires a hospital-scoped caller',
      );
    }

    return true;
  }
}
