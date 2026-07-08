import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreatePetDto, UpdatePetDto } from './pet.dto';

@Injectable()
export class PetService {
  constructor(private prisma: PrismaService) {}

  async create(userId: number, dto: CreatePetDto) {
    return this.prisma.pet.create({
      data: { userId, ...dto },
    });
  }

  async update(userId: number, dto: UpdatePetDto) {
    const pet = await this.prisma.pet.findFirst({ where: { id: dto.id, userId } });
    if (!pet) throw new ForbiddenException('宠物不存在');
    const { id, ...data } = dto;
    return this.prisma.pet.update({ where: { id }, data });
  }

  async delete(userId: number, id: number) {
    const pet = await this.prisma.pet.findFirst({ where: { id, userId } });
    if (!pet) throw new ForbiddenException('宠物不存在');
    await this.prisma.pet.delete({ where: { id } });
    return { success: true };
  }

  async list(userId: number) {
    return this.prisma.pet.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }
}
