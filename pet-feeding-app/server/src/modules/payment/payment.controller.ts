import { Controller, Post, Body, UseGuards, Req, RawBodyRequest } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  @Post('prepay')
  @UseGuards(JwtAuthGuard)
  async prepay(@Req() req, @Body('orderId') orderId: number) {
    return this.paymentService.createPrepay(req.user.userId, req.user.openid, orderId);
  }

  @Post('notify')
  async notify(@Req() req: RawBodyRequest<any>) {
    return this.paymentService.handleNotify(req.body);
  }
}
