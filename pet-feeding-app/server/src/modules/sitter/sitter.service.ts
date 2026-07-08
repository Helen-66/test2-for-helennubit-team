import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { ApplySitterDto, UpdateServiceDto } from './sitter.dto';
import * as CryptoJS from 'crypto-js';

const GEO_KEY = 'pet_sitter:geo';

@Injectable()
export class SitterService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async apply(userId: number, dto: ApplySitterDto) {
    const existing = await this.prisma.petSitter.findUnique({ where: { userId } });
    if (existing) throw new BadRequestException('已提交过认证申请');

    // 加密身份证号
    const encryptedIdCard = CryptoJS.AES.encrypt(dto.idCardNo, process.env.AES_KEY).toString();

    const sitter = await this.prisma.petSitter.create({
      data: {
        userId,
        realName: dto.realName,
        idCardNo: encryptedIdCard,
        idCardFront: dto.idCardFront,
        idCardBack: dto.idCardBack,
        idCardHold: dto.idCardHold,
        certImages: dto.certImages || [],
        longitude: dto.longitude,
        latitude: dto.latitude,
        address: dto.address,
        serviceItems: dto.serviceItems,
        availableTime: dto.availableTime || [],
      },
    });

    // 更新用户角色
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 2 },
    });

    return sitter;
  }

  async findNearby(lng: number, lat: number, radius: number) {
    // 从Redis GEO查询附近宠托师
    const results = await this.redis.geoRadius(GEO_KEY, lng, lat, radius, 'm');

    if (!results || results.length === 0) {
      return [];
    }

    // results格式: [[member, distance], ...]
    const sitterIds = results.map((item: any) => parseInt(item[0]));
    const distances = new Map(results.map((item: any) => [parseInt(item[0]), parseFloat(item[1])]));

    const sitters = await this.prisma.petSitter.findMany({
      where: {
        id: { in: sitterIds },
        auditStatus: 1,
        isOnline: true,
      },
      select: {
        id: true,
        realName: true,
        address: true,
        serviceItems: true,
        rating: true,
        orderCount: true,
        availableTime: true,
        user: { select: { avatarUrl: true, nickname: true } },
      },
    });

    return sitters.map((s) => ({
      ...s,
      distance: distances.get(s.id) || 0,
    })).sort((a, b) => a.distance - b.distance);
  }

  async getDetail(sitterId: number) {
    const sitter = await this.prisma.petSitter.findUnique({
      where: { id: sitterId },
      include: {
        user: { select: { avatarUrl: true, nickname: true } },
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { nickname: true, avatarUrl: true } } },
        },
      },
    });
    return sitter;
  }

  async toggleOnline(userId: number, isOnline: boolean) {
    const sitter = await this.prisma.petSitter.findUnique({ where: { userId } });
    if (!sitter) throw new BadRequestException('未注册宠托师');
    if (sitter.auditStatus !== 1) throw new BadRequestException('认证未通过');

    await this.prisma.petSitter.update({
      where: { userId },
      data: { isOnline },
    });

    if (isOnline) {
      await this.redis.geoAdd(GEO_KEY, Number(sitter.longitude), Number(sitter.latitude), String(sitter.id));
    } else {
      await this.redis.geoRemove(GEO_KEY, String(sitter.id));
    }

    return { isOnline };
  }

  async updateService(userId: number, dto: UpdateServiceDto) {
    const sitter = await this.prisma.petSitter.findUnique({ where: { userId } });
    if (!sitter) throw new BadRequestException('未注册宠托师');

    const updateData: any = {};
    if (dto.serviceItems) updateData.serviceItems = dto.serviceItems;
    if (dto.availableTime) updateData.availableTime = dto.availableTime;
    if (dto.longitude) updateData.longitude = dto.longitude;
    if (dto.latitude) updateData.latitude = dto.latitude;
    if (dto.address) updateData.address = dto.address;

    const updated = await this.prisma.petSitter.update({ where: { userId }, data: updateData });

    // 如果更新了位置且在线，同步Redis GEO
    if ((dto.longitude || dto.latitude) && sitter.isOnline) {
      await this.redis.geoAdd(
        GEO_KEY,
        Number(updated.longitude),
        Number(updated.latitude),
        String(sitter.id),
      );
    }

    return updated;
  }

  async getSitterInfo(userId: number) {
    return this.prisma.petSitter.findUnique({
      where: { userId },
      include: { user: { select: { nickname: true, avatarUrl: true, phone: true } } },
    });
  }
}
