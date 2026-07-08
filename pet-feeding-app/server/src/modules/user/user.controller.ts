import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { WxLoginDto, BindPhoneDto, UpdateUserDto } from './user.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Post('login')
  async login(@Body() dto: WxLoginDto) {
    return this.userService.wxLogin(dto.code);
  }

  @Post('bindPhone')
  @UseGuards(JwtAuthGuard)
  async bindPhone(@Req() req, @Body() dto: BindPhoneDto) {
    return this.userService.bindPhone(req.user.userId, dto.code);
  }

  @Post('update')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req, @Body() dto: UpdateUserDto) {
    return this.userService.updateProfile(req.user.userId, dto);
  }

  @Get('info')
  @UseGuards(JwtAuthGuard)
  async getUserInfo(@Req() req) {
    return this.userService.getUserInfo(req.user.userId);
  }
}
