import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { CreateOrderDto, RejectOrderDto, SignInDto, CancelOrderDto } from './order.dto';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async create(userId: number, dto: CreateOrderDto) {
    // 防重复提交
    const lockKey = `order:lock:${userId}`;
    const locked = await this.redis.setNx(lockKey, '1', 10);
    if (!locked) throw new BadRequestException('请勿重复提交');

    try {
      const sitter = await this.prisma.petSitter.findUnique({ where: { id: dto.sitterId } });
      if (!sitter || sitter.auditStatus !== 1) throw new BadRequestException('宠托师不可用');

      // 计算费用
      const days = this.calcDays(dto.serviceDateStart, dto.serviceDateEnd);
      const totalAmount = this.calcAmount(sitter.serviceItems as any[], dto.serviceItems, days, dto.dailyTimes);
      const platformFeeRate = parseFloat(process.env.PLATFORM_FEE_RATE || '0.1');
      const platformFee = +(totalAmount * platformFeeRate).toFixed(2);
      const sitterIncome = +(totalAmount - platformFee).toFixed(2);

      const order = await this.prisma.order.create({
        data: {
          orderNo: this.generateOrderNo(),
          userId,
          sitterId: dto.sitterId,
          petIds: dto.petIds,
          status: 0, // 待支付
          serviceDateStart: new Date(dto.serviceDateStart),
          serviceDateEnd: new Date(dto.serviceDateEnd),
          dailyTimes: dto.dailyTimes,
          serviceItems: dto.serviceItems,
          serviceAddress: dto.serviceAddress,
          addressLng: dto.addressLng,
          addressLat: dto.addressLat,
          totalAmount,
          platformFee,
          sitterIncome,
          remark: dto.remark,
        },
      });

      return order;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  async cancel(userId: number, dto: CancelOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, userId },
    });
    if (!order) throw new ForbiddenException('订单不存在');
    if (order.status > 1) throw new BadRequestException('当前状态不可取消');

    await this.prisma.order.update({
      where: { id: dto.orderId },
      data: { status: 5, cancelReason: dto.reason },
    });

    // 如已支付则退款（status=1时已支付）
    if (order.status === 1) {
      // TODO: 调用微信退款接口
    }

    return { success: true };
  }

  async getUserOrders(userId: number, status?: number) {
    const where: any = { userId };
    if (status !== undefined) where.status = status;
    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { sitter: { select: { realName: true, user: { select: { avatarUrl: true } } } } },
    });
  }

  async getDetail(userId: number, orderId: number) {
    return this.prisma.order.findFirst({
      where: { id: orderId, OR: [{ userId }, { sitter: { userId } }] },
      include: {
        sitter: { select: { realName: true, address: true, user: { select: { avatarUrl: true, phone: true } } } },
        user: { select: { nickname: true, phone: true } },
      },
    });
  }

  async getSitterPendingOrders(userId: number) {
    const sitter = await this.prisma.petSitter.findUnique({ where: { userId } });
    if (!sitter) throw new BadRequestException('非宠托师');
    return this.prisma.order.findMany({
      where: { sitterId: sitter.id, status: 1 },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { nickname: true, avatarUrl: true, phone: true } } },
    });
  }

  async getSitterOrders(userId: number, status?: number) {
    const sitter = await this.prisma.petSitter.findUnique({ where: { userId } });
    if (!sitter) throw new BadRequestException('非宠托师');
    const where: any = { sitterId: sitter.id };
    if (status !== undefined) where.status = status;
    return this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { nickname: true, avatarUrl: true } } },
    });
  }

  async accept(userId: number, orderId: number) {
    const sitter = await this.prisma.petSitter.findUnique({ where: { userId } });
    if (!sitter) throw new BadRequestException('非宠托师');
    const order = await this.prisma.order.findFirst({ where: { id: orderId, sitterId: sitter.id, status: 1 } });
    if (!order) throw new BadRequestException('订单不存在或状态异常');

    await this.prisma.order.update({ where: { id: orderId }, data: { status: 2 } });
    return { success: true };
  }

  async reject(userId: number, dto: RejectOrderDto) {
    const sitter = await this.prisma.petSitter.findUnique({ where: { userId } });
    if (!sitter) throw new BadRequestException('非宠托师');
    const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, sitterId: sitter.id, status: 1 } });
    if (!order) throw new BadRequestException('订单不存在或状态异常');

    await this.prisma.order.update({
      where: { id: dto.orderId },
      data: { status: 6, rejectReason: dto.reason },
    });

    // TODO: 退款给用户
    return { success: true };
  }

  async signIn(userId: number, dto: SignInDto) {
    const sitter = await this.prisma.petSitter.findUnique({ where: { userId } });
    if (!sitter) throw new BadRequestException('非宠托师');
    const order = await this.prisma.order.findFirst({ where: { id: dto.orderId, sitterId: sitter.id, status: 2 } });
    if (!order) throw new BadRequestException('订单不存在或状态异常');

    // GPS签到校验: 500米范围内
    const distance = this.calcDistance(
      dto.latitude, dto.longitude,
      Number(order.addressLat), Number(order.addressLng),
    );
    if (distance > 500) {
      throw new BadRequestException(`距离服务地址${Math.round(distance)}米，需在500米范围内签到`);
    }

    await this.prisma.order.update({
      where: { id: dto.orderId },
      data: { status: 3, signInTime: new Date(), signInLng: dto.longitude, signInLat: dto.latitude },
    });
    return { success: true };
  }

  async complete(userId: number, orderId: number) {
    const sitter = await this.prisma.petSitter.findUnique({ where: { userId } });
    if (!sitter) throw new BadRequestException('非宠托师');
    const order = await this.prisma.order.findFirst({ where: { id: orderId, sitterId: sitter.id, status: 3 } });
    if (!order) throw new BadRequestException('订单不存在或状态异常');

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 4, completeTime: new Date() },
    });

    // 更新宠托师完成订单数
    await this.prisma.petSitter.update({
      where: { id: sitter.id },
      data: { orderCount: { increment: 1 } },
    });

    return { success: true };
  }

  async review(userId: number, data: { orderId: number; rating: number; content?: string; images?: string[] }) {
    const order = await this.prisma.order.findFirst({ where: { id: data.orderId, userId, status: 4 } });
    if (!order) throw new BadRequestException('订单不存在或不可评价');

    const existing = await this.prisma.review.findUnique({ where: { orderId: data.orderId } });
    if (existing) throw new BadRequestException('已评价');

    await this.prisma.review.create({
      data: {
        orderId: data.orderId,
        userId,
        sitterId: order.sitterId,
        rating: data.rating,
        content: data.content,
        images: data.images || [],
      },
    });

    // 更新宠托师平均评分
    const avgResult = await this.prisma.review.aggregate({
      where: { sitterId: order.sitterId },
      _avg: { rating: true },
    });
    if (avgResult._avg.rating) {
      await this.prisma.petSitter.update({
        where: { id: order.sitterId },
        data: { rating: +avgResult._avg.rating.toFixed(1) },
      });
    }

    return { success: true };
  }

  // === 工具方法 ===

  private generateOrderNo(): string {
    const now = new Date();
    const ts = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PF${ts}${random}`;
  }

  private calcDays(start: string, end: string): number {
    const s = new Date(start);
    const e = new Date(end);
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  private calcAmount(sitterItems: any[], selectedItems: string[], days: number, dailyTimes: number): number {
    let total = 0;
    for (const item of sitterItems) {
      if (selectedItems.includes(item.name)) {
        total += item.price;
      }
    }
    return +(total * days * dailyTimes).toFixed(2);
  }

  // Haversine公式计算两点距离(米)
  private calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
