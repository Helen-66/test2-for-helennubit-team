import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './modules/user/user.module';
import { PetModule } from './modules/pet/pet.module';
import { SitterModule } from './modules/sitter/sitter.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { CommonModule } from './modules/common/common.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CommonModule,
    UserModule,
    PetModule,
    SitterModule,
    OrderModule,
    PaymentModule,
  ],
})
export class AppModule {}
