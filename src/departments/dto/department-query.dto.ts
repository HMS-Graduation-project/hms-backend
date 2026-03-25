import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Query parameters for listing departments.
 *
 * Inherits page, limit, sortBy, sortOrder, and search from PaginationQueryDto.
 * Search is applied against department name and description.
 */
export class DepartmentQueryDto extends PaginationQueryDto {}
