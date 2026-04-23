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

  // cityId is resolved from the user's hospital at token time. REGIONAL_ADMIN
  // / MINISTRY_ADMIN roles don't exist until Phase 2, so cityId is always null
  // in Phase 1 unless manually attached via hospital.cityId for city-bound roles.
  private async generateToken(
    userId: string,
    email: string,
    role: string,
    hospitalId: string | null,
  ): Promise<string> {
    let cityId: string | null = null;
    if (hospitalId) {
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
