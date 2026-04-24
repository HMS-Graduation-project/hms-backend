import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
    });

    const token = await this.generateToken(
      user.id,
      user.email,
      user.role,
      user.hospitalId ?? null,
      (user as { cityId?: string | null }).cityId ?? null,
    );
    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        hospitalId: user.hospitalId ?? null,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.generateToken(
      user.id,
      user.email,
      user.role,
      user.hospitalId ?? null,
      (user as { cityId?: string | null }).cityId ?? null,
    );
    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        hospitalId: user.hospitalId ?? null,
      },
    };
  }

  // cityId resolution (Phase 6):
  //  - If the user has an explicit cityId (REGIONAL_ADMIN), use it.
  //  - Else if the user is bound to a hospital, inherit hospital.cityId.
  //  - Else (SUPER_ADMIN / MINISTRY_ADMIN with no explicit city) leave null.
  private async generateToken(
    userId: string,
    email: string,
    role: string,
    hospitalId: string | null,
    userCityId: string | null,
  ): Promise<string> {
    let cityId: string | null = userCityId;
    if (!cityId && hospitalId) {
      const hospital = await this.prisma.hospital.findUnique({
        where: { id: hospitalId },
        select: { cityId: true },
      });
      cityId = hospital?.cityId ?? null;
    }
    return this.jwtService.sign({
      sub: userId,
      email,
      role,
      hospitalId,
      cityId,
    });
  }
}
