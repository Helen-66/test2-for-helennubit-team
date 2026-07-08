import { Controller, Post, Get, Body, UseGuards, Req, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, RejectOrderDto, SignInDto, CancelOrderDto } from './order.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Controller('order')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private orderService: OrderService) {}

  // === 用户端 ===
  @Post('create')
  async create(@Req() req, @Body() dto: CreateOrderDto) {
    return this.orderService.create(req.user.userId, dto);
  }

  @Post('cancel')
  async cancel(@Req() req, @Body() dto: CancelOrderDto) {
    return this.orderService.cancel(req.user.userId, dto);
  }

  @Get('list')
  async userOrders(@Req() req, @Query('status') status?: string) {
    return this.orderService.getUserOrders(req.user.userId, status ? parseInt(status) : undefined);
  }

  @Get('detail')
  async detail(@Req() req, @Query('id') id: string) {
    return this.orderService.getDetail(req.user.userId, parseInt(id));
  }

  // === 宠托师端 ===
  @Get('sitter/pending')
  async sitterPending(@Req() req) {
    return this.orderService.getSitterPendingOrders(req.user.userId);
  }

  @Get('sitter/list')
  async sitterOrders(@Req() req, @Query('status') status?: string) {
    return this.orderService.getSitterOrders(req.user.userId, status ? parseInt(status) : undefined);
  }

  @Post('sitter/accept')
  async accept(@Req() req, @Body('orderId') orderId: number) {
    return this.orderService.accept(req.user.userId, orderId);
  }

  @Post('sitter/reject')
  async reject(@Req() req, @Body() dto: RejectOrderDto) {
    return this.orderService.reject(req.user.userId, dto);
  }

  @Post('sitter/signin')
  async signIn(@Req() req, @Body() dto: SignInDto) {
    return this.orderService.signIn(req.user.userId, dto);
  }

  @Post('sitter/complete')
  async complete(@Req() req, @Body('orderId') orderId: number) {
    return this.orderService.complete(req.user.userId, orderId);
  }

  // === 评价 ===
  @Post('review')
  async review(@Req() req, @Body() body: { orderId: number; rating: number; content?: string; images?: string[] }) {
    return this.orderService.review(req.user.userId, body);
  }
}
