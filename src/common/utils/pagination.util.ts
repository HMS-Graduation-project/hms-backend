import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

/**
 * Generic Prisma pagination helper.
 *
 * Accepts any Prisma model delegate that exposes `findMany` and `count`
 * (e.g. `prisma.user`, `prisma.appointment`) and returns a standardised
 * `PaginatedResponseDto<T>` envelope.
 *
 * @example
 * ```ts
 * const result = await paginate<User>(prisma.user, {
 *   where: { isActive: true },
 *   include: { profile: true },
 * }, query);
 * ```
 */
export async function paginate<T>(
  model: {
    findMany: (args: Record<string, unknown>) => Promise<T[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
  },
  args: {
    where?: Record<string, unknown>;
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
  },
  query: PaginationQueryDto,
): Promise<PaginatedResponseDto<T>> {
  const { page, limit, sortBy, sortOrder } = query;

  const skip = (page - 1) * limit;
  const take = limit;

  // Build orderBy: explicit sortBy takes priority over any caller-supplied orderBy
  const orderBy = sortBy
    ? { [sortBy]: sortOrder }
    : args.orderBy ?? { createdAt: 'desc' };

  const findArgs: Record<string, unknown> = {
    where: args.where,
    orderBy,
    skip,
    take,
  };

  if (args.select) {
    findArgs.select = args.select;
  } else if (args.include) {
    findArgs.include = args.include;
  }

  const countArgs: Record<string, unknown> = {
    where: args.where,
  };

  const [data, total] = await Promise.all([
    model.findMany(findArgs),
    model.count(countArgs),
  ]);

  return PaginatedResponseDto.of<T>(data, total, page, limit);
}
