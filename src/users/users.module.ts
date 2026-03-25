import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { MeController } from './users.controller';
import { AdminUsersController } from './admin-users.controller';

@Module({
  providers: [UsersService],
  controllers: [MeController, AdminUsersController],
  exports: [UsersService],
})
export class UsersModule {}
