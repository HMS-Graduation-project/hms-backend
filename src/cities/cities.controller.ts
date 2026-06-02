import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { CitiesService } from './cities.service';

@ApiTags('Cities')
@ApiBearerAuth()
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  @ApiOperation({ summary: 'List all cities' })
  findAll() {
    return this.citiesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get city by ID with its hospitals' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.citiesService.findById(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.MINISTRY_ADMIN)
  @ApiOperation({ summary: 'Create a new city' })
  create(@Body() dto: CreateCityDto) {
    return this.citiesService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.MINISTRY_ADMIN)
  @ApiOperation({ summary: 'Update a city' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCityDto,
  ) {
    return this.citiesService.update(id, dto);
  }
}
