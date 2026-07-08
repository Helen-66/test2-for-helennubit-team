import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class WxService {
  private appid = process.env.WX_APPID;
  private secret = process.env.WX_SECRET;

  // 微信登录：code换取openid和session_key
  async code2Session(code: string): Promise<{ openid: string; sessionKey: string; unionid?: string }> {
    const url = 'https://api.weixin.qq.com/sns/jscode2session';
    const res = await axios.get(url, {
      params: {
        appid: this.appid,
        secret: this.secret,
        js_code: code,
        grant_type: 'authorization_code',
      },
    });
    if (res.data.errcode) {
      throw new Error(`微信登录失败: ${res.data.errmsg}`);
    }
    return {
      openid: res.data.openid,
      sessionKey: res.data.session_key,
      unionid: res.data.unionid,
    };
  }

  // 获取手机号
  async getPhoneNumber(code: string): Promise<string> {
    const accessToken = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;
    const res = await axios.post(url, { code });
    if (res.data.errcode !== 0) {
      throw new Error(`获取手机号失败: ${res.data.errmsg}`);
    }
    return res.data.phone_info.phoneNumber;
  }

  // 获取access_token
  private async getAccessToken(): Promise<string> {
    const url = 'https://api.weixin.qq.com/cgi-bin/token';
    const res = await axios.get(url, {
      params: {
        grant_type: 'client_credential',
        appid: this.appid,
        secret: this.secret,
      },
    });
    return res.data.access_token;
  }

  // 发送订阅消息
  async sendSubscribeMessage(openid: string, templateId: string, data: Record<string, any>, page?: string) {
    const accessToken = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`;
    await axios.post(url, {
      touser: openid,
      template_id: templateId,
      page: page || '',
      data,
    });
  }
}
