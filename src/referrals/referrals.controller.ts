import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { ReferralsService } from './referrals.service';
import { CreateReferralDto } from './dto/create-referral.dto';
import { AcceptReferralDto } from './dto/accept-referral.dto';
import { RejectReferralDto } from './dto/reject-referral.dto';
import { CompleteReferralDto } from './dto/complete-referral.dto';
import { CancelReferralDto } from './dto/cancel-referral.dto';
import { ReferralQueryDto } from './dto/referral-query.dto';

/**
 * Referrals — inter-hospital patient transfer.
 *
 * Not tenant-scoped: a Referral spans two hospitals. Visibility is enforced
 * at the service layer (caller must be party, either side).
 */
@ApiTags('Referrals')
@ApiBearerAuth()
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  // ─── Listing ───────────────────────────────────────────────────────

  @Get('incoming')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
  )
  @ApiOperation({ summary: 'List referrals sent TO my hospital' })
  listIncoming(
    @Query() query: ReferralQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.listIncoming(query, user);
  }

  @Get('outgoing')
  @Roles(
    Role.SUPER_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
  )
  @ApiOperation({ summary: 'List referrals sent FROM my hospital' })
  listOutgoing(
    @Query() query: ReferralQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.listOutgoing(query, user);
  }

  @Get('patients/:nhid')
  @Roles(
    Role.SUPER_ADMIN,
    Role.MINISTRY_ADMIN,
    Role.REGIONAL_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
  )
  @ApiOperation({
    summary: 'List all referrals tied to a national patient (caller must be party)',
  })
  listForPatient(
    @Param('nhid', ParseUUIDPipe) nhid: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.listForPatient(nhid, user);
  }

  @Get('patients/:nhid/cross-hospital-records')
  @Roles(
    Role.SUPER_ADMIN,
    Role.MINISTRY_ADMIN,
    Role.REGIONAL_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
  )
  @ApiOperation({
    summary:
      "Fetch the patient's records from OTHER hospitals. Gated by canReadCrossHospital.",
  })
  getCrossHospitalRecords(
    @Param('nhid', ParseUUIDPipe) nhid: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.getCrossHospitalRecords(nhid, user);
  }

  @Get(':id')
  @Roles(
    Role.SUPER_ADMIN,
    Role.MINISTRY_ADMIN,
    Role.REGIONAL_ADMIN,
    Role.ADMIN,
    Role.HOSPITAL_ADMIN,
    Role.DOCTOR,
    Role.NURSE,
  )
  @ApiOperation({ summary: 'Get referral detail' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findById(id, user);
  }

  // ─── Author ────────────────────────────────────────────────────────

  @Post()
  @Roles(Role.DOCTOR, Role.HOSPITAL_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Create an outgoing referral' })
  create(
    @Body() dto: CreateReferralDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user);
  }

  // ─── Transitions ───────────────────────────────────────────────────

  @Patch(':id/accept')
  @Roles(Role.DOCTOR, Role.HOSPITAL_ADMIN, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Accept an incoming referral' })
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptReferralDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.accept(id, dto, user);
  }

  @Patch(':id/reject')
  @Roles(Role.DOCTOR, Role.HOSPITAL_ADMIN, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reject an incoming referral' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectReferralDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reject(id, dto, user);
  }

  @Patch(':id/complete')
  @Roles(Role.DOCTOR, Role.HOSPITAL_ADMIN, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mark an accepted referral as completed' })
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteReferralDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.complete(id, dto, user);
  }

  @Patch(':id/cancel')
  @Roles(Role.DOCTOR, Role.HOSPITAL_ADMIN, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Cancel a pending or accepted referral (sender only)' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelReferralDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.cancel(id, dto, user);
  }
}
