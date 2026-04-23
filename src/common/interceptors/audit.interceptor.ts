import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * HTTP method → audit action mapping.
 * Only mutating methods are tracked; GET/HEAD/OPTIONS are ignored.
 */
const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/**
 * Global interceptor that writes an AuditLog row after every successful
 * POST, PATCH, PUT, or DELETE request.
 *
 * The write is fire-and-forget so it never delays the HTTP response.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method.toUpperCase();

    const action = METHOD_ACTION_MAP[method];
    if (!action) {
      // GET, HEAD, OPTIONS, etc. are not audited
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        // Extract entity name from the controller class (strip "Controller" suffix)
        const controllerClass = context.getClass();
        const entity = controllerClass.name.replace(/Controller$/, '');

        const userId: string | undefined = (request as any).user?.id;
        const entityId: string | undefined = request.params?.id;
        const ipAddress =
          request.ip || request.headers['x-forwarded-for']?.toString();

        // Fire-and-forget: do NOT await so the response is not blocked
        this.prisma.auditLog
          .create({
            data: {
              userId: userId ?? null,
              action,
              entity,
              entityId: entityId ?? null,
              changes: this.safeStringify(request.body),
              ipAddress: ipAddress ?? null,
            },
          })
          .catch((err: Error) => {
            this.logger.error(
              `Failed to write audit log: ${err.message}`,
              err.stack,
            );
          });
      }),
    );
  }

  /**
   * Safely serialise the request body to JSON.
   * Returns null when body is empty or cannot be serialised.
   */
  private safeStringify(body: unknown): string | null {
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      return null;
    }
    try {
      return JSON.stringify(body);
    } catch {
      return null;
    }
  }
}
