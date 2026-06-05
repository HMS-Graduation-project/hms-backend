import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Response, Request } from 'express';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly isProduction: boolean;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.isProduction = config.get('NODE_ENV') === 'production';
  }

  async register(dto: RegisterDto, req: Request, res: Response) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
    });

    const accessToken = await this.generateAccessToken(
      user.id, user.email, user.role,
      user.hospitalId ?? null,
      (user as { cityId?: string | null }).cityId ?? null,
    );

    const refreshToken = await this.createRefreshToken(user.id, req);
    this.setCookies(res, accessToken, refreshToken);

    return {
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

  async login(dto: LoginDto, req: Request, res: Response) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.generateAccessToken(
      user.id, user.email, user.role,
      user.hospitalId ?? null,
      (user as { cityId?: string | null }).cityId ?? null,
    );

    const refreshToken = await this.createRefreshToken(user.id, req);
    this.setCookies(res, accessToken, refreshToken);

    return {
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

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.hms_refresh;
    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }

    const tokenHash = this.hashToken(token);
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection: if token was already revoked, revoke the entire family
    if (record.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for family ${record.familyId}, user ${record.userId}`,
      );
      await this.prisma.refreshToken.updateMany({
        where: { familyId: record.familyId },
        data: { revokedAt: new Date() },
      });
      this.clearCookies(res);
      throw new UnauthorizedException('Token reuse detected — session revoked');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke old token
    const newRawToken = crypto.randomUUID();
    const newTokenHash = this.hashToken(newRawToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: record.id },
        data: { revokedAt: new Date(), replacedBy: newTokenHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: record.userId,
          tokenHash: newTokenHash,
          familyId: record.familyId,
          expiresAt,
          userAgent: req.headers['user-agent'] ?? null,
          ipAddress: req.ip ?? null,
        },
      }),
    ]);

    const user = record.user;
    const accessToken = await this.generateAccessToken(
      user.id, user.email, user.role,
      user.hospitalId ?? null,
      (user as { cityId?: string | null }).cityId ?? null,
    );

    this.setCookies(res, accessToken, newRawToken);

    return {
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

  async logout(req: Request, res: Response) {
    const token = req.cookies?.hms_refresh;
    if (token) {
      const tokenHash = this.hashToken(token);
      const record = await this.prisma.refreshToken.findFirst({
        where: { tokenHash },
      });
      if (record) {
        // Revoke entire token family
        await this.prisma.refreshToken.updateMany({
          where: { familyId: record.familyId },
          data: { revokedAt: new Date() },
        });
      }
    }
    this.clearCookies(res);
  }

  // ── Private helpers ──────────────────────────────────────────────

  private async generateAccessToken(
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

  private async createRefreshToken(userId: string, req: Request): Promise<string> {
    const rawToken = crypto.randomUUID();
    const tokenHash = this.hashToken(rawToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        familyId,
        expiresAt,
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      },
    });

    return rawToken;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  setCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie('hms_access', accessToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/api',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('hms_refresh', refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  private clearCookies(res: Response) {
    res.clearCookie('hms_access', { path: '/api' });
    res.clearCookie('hms_refresh', { path: '/api/v1/auth' });
  }
}
