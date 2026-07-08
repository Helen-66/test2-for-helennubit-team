import { Controller, Post, Get, Body, UseGuards, Req, Query } from '@nestjs/common';
import { SitterService } from './sitter.service';
import { ApplySitterDto, UpdateServiceDto } from './sitter.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Controller('sitter')
export class SitterController {
  constructor(private sitterService: SitterService) {}

  @Post('apply')
  @UseGuards(JwtAuthGuard)
  async apply(@Req() req, @Body() dto: ApplySitterDto) {
    return this.sitterService.apply(req.user.userId, dto);
  }

  @Get('nearby')
  @UseGuards(JwtAuthGuard)
  async nearby(@Query('lng') lng: string, @Query('lat') lat: string, @Query('radius') radius?: string) {
    return this.sitterService.findNearby(parseFloat(lng), parseFloat(lat), parseInt(radius || '3000'));
  }

  @Get('detail')
  @UseGuards(JwtAuthGuard)
  async detail(@Query('id') id: string) {
    return this.sitterService.getDetail(parseInt(id));
  }

  @Post('online')
  @UseGuards(JwtAuthGuard)
  async toggleOnline(@Req() req, @Body('isOnline') isOnline: boolean) {
    return this.sitterService.toggleOnline(req.user.userId, isOnline);
  }

  @Post('updateService')
  @UseGuards(JwtAuthGuard)
  async updateService(@Req() req, @Body() dto: UpdateServiceDto) {
    return this.sitterService.updateService(req.user.userId, dto);
  }

  @Get('info')
  @UseGuards(JwtAuthGuard)
  async getSitterInfo(@Req() req) {
    return this.sitterService.getSitterInfo(req.user.userId);
  }
}
