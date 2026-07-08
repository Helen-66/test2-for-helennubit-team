import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma.service';
import { WxService } from '../common/wx.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private wxService: WxService,
  ) {}

  async wxLogin(code: string) {
    const wxSession = await this.wxService.code2Session(code);

    let user = await this.prisma.user.findUnique({
      where: { openid: wxSession.openid },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          openid: wxSession.openid,
          unionid: wxSession.unionid,
        },
      });
    }

    const token = this.jwtService.sign({
      userId: user.id,
      openid: user.openid,
      role: user.role,
    });

    return { token, user: { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl, role: user.role, phone: user.phone } };
  }

  async bindPhone(userId: number, code: string) {
    const phone = await this.wxService.getPhoneNumber(code);
    await this.prisma.user.update({
      where: { id: userId },
      data: { phone },
    });
    return { phone };
  }

  async updateProfile(userId: number, data: { nickname?: string; avatarUrl?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async getUserInfo(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, nickname: true, avatarUrl: true, phone: true, role: true },
    });
  }
}
