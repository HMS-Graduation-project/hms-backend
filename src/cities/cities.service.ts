import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.city.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { hospitals: true } } },
    });
  }

  async findById(id: string) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      include: { hospitals: { select: { id: true, code: true, name: true } } },
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
        country: dto.country ?? 'SY',
      },
    });
  }
}
