import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.city.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { hospitals: true, users: true } } },
    });
  }

  async findById(id: string) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: {
        hospitals: {
          select: { id: true, code: true, name: true, nameAr: true, isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!city) {
      throw new NotFoundException(`City with id "${id}" not found`);
    }
    return city;
  }

  async create(dto: CreateCityDto) {
    const existing = await this.prisma.city.findUnique({
      where: { name: dto.name },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`City "${dto.name}" already exists`);
    }
    return this.prisma.city.create({
      data: {
        name: dto.name,
        nameAr: dto.nameAr,
        governorate: dto.governorate,
        country: dto.country ?? 'SY',
      },
    });
  }

  async update(id: string, dto: UpdateCityDto) {
    const existing = await this.prisma.city.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`City with id "${id}" not found`);
    }

    // Guard: name uniqueness if changing name
    if (dto.name) {
      const clash = await this.prisma.city.findUnique({
        where: { name: dto.name },
        select: { id: true },
      });
      if (clash && clash.id !== id) {
        throw new ConflictException(`City "${dto.name}" already exists`);
      }
    }

    return this.prisma.city.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.governorate !== undefined && { governorate: dto.governorate }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }
}
