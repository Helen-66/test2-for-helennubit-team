import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  }

  getClient(): Redis {
    return this.client;
  }

  // 地理位置相关
  async geoAdd(key: string, lng: number, lat: number, member: string) {
    return this.client.geoadd(key, lng, lat, member);
  }

  async geoRadius(key: string, lng: number, lat: number, radius: number, unit: 'm' | 'km' = 'm') {
    return this.client.georadius(key, lng, lat, radius, unit, 'WITHDIST', 'ASC', 'COUNT', 50);
  }

  async geoRemove(key: string, member: string) {
    return this.client.zrem(key, member);
  }

  // 通用操作
  async set(key: string, value: string, ttl?: number) {
    if (ttl) {
      return this.client.set(key, value, 'EX', ttl);
    }
    return this.client.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async del(key: string) {
    return this.client.del(key);
  }

  async setNx(key: string, value: string, ttl: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttl, 'NX');
    return result === 'OK';
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
