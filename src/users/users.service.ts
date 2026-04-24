import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/utils/pagination.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserQueryDto } from './dto/user-query.dto';

/** All User fields except passwordHash. */
const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  gender: true,
  dateOfBirth: true,
  address: true,
  hospitalId: true,
  cityId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Convenience type for a User object without passwordHash. */
export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────── Lookup helpers (used by auth) ─────────────────────

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Return a single user by ID without the passwordHash field.
   * Throws NotFoundException when the user does not exist.
   */
  async findByIdSafe(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    return user;
  }

  // ───────────────── Auth-level creation (no password in DTO) ──────────────

  async create(data: { email: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  // ──────────────────── Admin CRUD ─────────────────────────────────────────

  /**
   * Paginated list of users with optional search and role filter.
   * When `hospitalId` is provided (hospital-scoped admin), scopes the query to
   * that hospital. SUPER_ADMIN passes null → unscoped (all hospitals).
   */
  async findAll(query: UserQueryDto, hospitalId: string | null) {
    const where: Record<string, unknown> = {};

    if (hospitalId) {
      where.hospitalId = hospitalId;
    }

    if (query.role) {
      where.role = query.role;
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return paginate<SafeUser>(
      this.prisma.user as any,
      { where, select: { ...USER_SELECT } },
      query,
    );
  }

  /**
   * Create a user from the admin panel. Hashes the password internally.
   * `hospitalId` is the scope of the creating admin; SUPER_ADMIN may pass null
   * to create a national user (or another SUPER_ADMIN).
   */
  async createByAdmin(dto: CreateUserDto, hospitalId: string | null): Promise<SafeUser> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        hospitalId,
      },
      select: USER_SELECT,
    });
  }

  /**
   * Admin update of any user's profile fields (no password change).
   */
  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    await this.ensureUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
  }

  /**
   * Self-service profile update (limited fields).
   */
  async updateProfile(id: string, dto: UpdateProfileDto): Promise<SafeUser> {
    await this.ensureUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        address: dto.address,
      },
      select: USER_SELECT,
    });
  }

  /**
   * Soft-deactivate a user (sets isActive = false).
   */
  async deactivate(id: string): Promise<SafeUser> {
    await this.ensureUserExists(id);

    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: USER_SELECT,
    });
  }

  // ───────────────────── Private helpers ───────────────────────────────────

  private async ensureUserExists(id: string): Promise<void> {
    const count = await this.prisma.user.count({ where: { id } });
    if (count === 0) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
  }
}
