import { Module } from '@nestjs/common';
import { SitterController } from './sitter.controller';
import { SitterService } from './sitter.service';

@Module({
  controllers: [SitterController],
  providers: [SitterService],
  exports: [SitterService],
})
export class SitterModule {}
