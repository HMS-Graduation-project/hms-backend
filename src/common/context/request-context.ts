import { AsyncLocalStorage } from 'async_hooks';

/**
 * Per-request authentication + tenancy context.
 * Populated by RequestContextInterceptor after JwtAuthGuard validates the JWT.
 * Consumed by PrismaService middleware to auto-scope tenant-scoped reads
 * by hospitalId.
 */
export interface RequestContextData {
  userId: string | null;
  role: string | null;
  hospitalId: string | null;
  cityId: string | null;
}

const storage = new AsyncLocalStorage<RequestContextData>();

export const RequestContext = {
  /**
   * Binds the context to the current async execution. Per-request Express
   * handlers run in their own async scope, so enterWith is safe here.
   */
  set(ctx: RequestContextData): void {
    storage.enterWith(ctx);
  },
  run<T>(ctx: RequestContextData, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContextData | undefined {
    return storage.getStore();
  },
  getHospitalId(): string | null {
    return storage.getStore()?.hospitalId ?? null;
  },
  getRole(): string | null {
    return storage.getStore()?.role ?? null;
  },
  /**
   * True when the caller's role spans hospitals (SUPER_ADMIN, MINISTRY_ADMIN,
   * REGIONAL_ADMIN) — those users have hospitalId=null in their JWT.
   */
  isCrossHospital(): boolean {
    const ctx = storage.getStore();
    return !ctx?.hospitalId;
  },
};
