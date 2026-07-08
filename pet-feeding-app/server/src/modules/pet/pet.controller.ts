import { Controller, Post, Get, Body, UseGuards, Req, Param } from '@nestjs/common';
import { PetService } from './pet.service';
import { CreatePetDto, UpdatePetDto } from './pet.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Controller('pet')
@UseGuards(JwtAuthGuard)
export class PetController {
  constructor(private petService: PetService) {}

  @Post('create')
  async create(@Req() req, @Body() dto: CreatePetDto) {
    return this.petService.create(req.user.userId, dto);
  }

  @Post('update')
  async update(@Req() req, @Body() dto: UpdatePetDto) {
    return this.petService.update(req.user.userId, dto);
  }

  @Post('delete')
  async delete(@Req() req, @Body('id') id: number) {
    return this.petService.delete(req.user.userId, id);
  }

  @Get('list')
  async list(@Req() req) {
    return this.petService.list(req.user.userId);
  }
}
