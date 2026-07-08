import { Injectable, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma.service';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) {}

  // 创建微信预支付订单
  async createPrepay(userId: number, openid: string, orderId: number) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId, status: 0 } });
    if (!order) throw new BadRequestException('订单不存在或已支付');

    const params = {
      appid: process.env.WX_APPID,
      mch_id: process.env.WX_PAY_MCH_ID,
      nonce_str: this.randomStr(32),
      body: '宠物上门喂养服务',
      out_trade_no: order.orderNo,
      total_fee: Math.round(Number(order.totalAmount) * 100), // 分
      spbill_create_ip: '127.0.0.1',
      notify_url: process.env.WX_PAY_NOTIFY_URL,
      trade_type: 'JSAPI',
      openid,
    };

    const sign = this.signParams(params);
    const xml = this.toXml({ ...params, sign });

    const res = await axios.post('https://api.mch.weixin.qq.com/pay/unifiedorder', xml, {
      headers: { 'Content-Type': 'text/xml' },
    });

    // 解析返回的prepay_id，组装小程序支付参数
    const prepayId = this.parseXmlValue(res.data, 'prepay_id');
    const payParams = {
      appId: process.env.WX_APPID,
      timeStamp: String(Math.floor(Date.now() / 1000)),
      nonceStr: this.randomStr(32),
      package: `prepay_id=${prepayId}`,
      signType: 'MD5',
    };
    const paySign = this.signParams(payParams);

    return { ...payParams, paySign };
  }

  // 微信支付回调
  async handleNotify(xmlBody: string) {
    // 验签 & 解析
    const orderNo = this.parseXmlValue(xmlBody, 'out_trade_no');
    const resultCode = this.parseXmlValue(xmlBody, 'result_code');
    const transactionId = this.parseXmlValue(xmlBody, 'transaction_id');

    if (resultCode === 'SUCCESS') {
      const order = await this.prisma.order.findUnique({ where: { orderNo } });
      if (order && order.status === 0) {
        await this.prisma.order.update({
          where: { orderNo },
          data: { status: 1, paidAt: new Date() },
        });
        await this.prisma.payment.create({
          data: {
            orderId: order.id,
            transactionId,
            amount: order.totalAmount,
            type: 1, // 用户支付
            status: 1,
            payTime: new Date(),
          },
        });
      }
    }

    return '<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>';
  }

  // T+1自动结算打款（每小时执行）
  @Cron('0 0 * * * *')
  async autoSettlement() {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前

    const orders = await this.prisma.order.findMany({
      where: {
        status: 4,
        settleStatus: 0,
        completeTime: { lte: threshold },
      },
      include: { sitter: { include: { user: true } } },
    });

    for (const order of orders) {
      try {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { settleStatus: 1 }, // 结算中
        });

        // 调用微信企业付款到零钱
        await this.transferToSitter(order.sitter.user.openid, Number(order.sitterIncome), order.orderNo);

        await this.prisma.order.update({
          where: { id: order.id },
          data: { settleStatus: 2, settleTime: new Date() },
        });

        await this.prisma.payment.create({
          data: {
            orderId: order.id,
            amount: order.sitterIncome,
            type: 3, // 打款给宠托师
            status: 1,
            payTime: new Date(),
          },
        });
      } catch (e) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { settleStatus: 3 }, // 结算失败
        });
        console.error(`结算失败 orderNo=${order.orderNo}`, e);
      }
    }
  }

  // 企业付款到零钱
  private async transferToSitter(openid: string, amount: number, orderNo: string) {
    const params = {
      mch_appid: process.env.WX_APPID,
      mchid: process.env.WX_PAY_MCH_ID,
      nonce_str: this.randomStr(32),
      partner_trade_no: `T${orderNo}`,
      openid,
      check_name: 'NO_CHECK',
      amount: Math.round(amount * 100),
      desc: '宠物喂养服务收入',
    };

    const sign = this.signParams(params);
    const xml = this.toXml({ ...params, sign });

    await axios.post('https://api.mch.weixin.qq.com/mmpaymkttransfers/promotion/transfers', xml, {
      headers: { 'Content-Type': 'text/xml' },
      // 生产环境需配置双向证书
    });
  }

  // === 工具方法 ===

  private signParams(params: Record<string, any>): string {
    const keys = Object.keys(params).sort();
    const str = keys.map((k) => `${k}=${params[k]}`).join('&') + `&key=${process.env.WX_PAY_API_KEY}`;
    return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
  }

  private randomStr(len: number): string {
    return crypto.randomBytes(len).toString('hex').substring(0, len);
  }

  private toXml(obj: Record<string, any>): string {
    const items = Object.keys(obj).map((k) => `<${k}><![CDATA[${obj[k]}]]></${k}>`);
    return `<xml>${items.join('')}</xml>`;
  }

  private parseXmlValue(xml: string, key: string): string {
    const match = xml.match(new RegExp(`<${key}><!\\[CDATA\\[(.+?)\\]\\]></${key}>`));
    return match ? match[1] : '';
  }
}
