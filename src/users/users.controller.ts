import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

/**
 * Self-service profile endpoints.
 * All routes require an authenticated JWT (guards are global).
 */
@ApiTags('Profile')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  async getMe(
    @CurrentUser() currentUser: { id: string },
  ) {
    return this.usersService.findByIdSafe(currentUser.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update own profile' })
  async updateMe(
    @CurrentUser() currentUser: { id: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(currentUser.id, dto);
  }
}
