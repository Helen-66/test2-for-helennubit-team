import { IsInt, IsString, IsNumber, IsArray, IsOptional, IsDateString } from 'class-validator';

export class CreateOrderDto {
  @IsInt()
  sitterId: number;

  @IsArray()
  petIds: number[];

  @IsDateString()
  serviceDateStart: string;

  @IsDateString()
  serviceDateEnd: string;

  @IsInt()
  dailyTimes: number;

  @IsArray()
  serviceItems: string[];

  @IsString()
  serviceAddress: string;

  @IsNumber()
  addressLng: number;

  @IsNumber()
  addressLat: number;

  @IsOptional()
  @IsString()
  remark?: string;
}

export class RejectOrderDto {
  @IsInt()
  orderId: number;

  @IsString()
  reason: string;
}

export class SignInDto {
  @IsInt()
  orderId: number;

  @IsNumber()
  longitude: number;

  @IsNumber()
  latitude: number;
}

export class CancelOrderDto {
  @IsInt()
  orderId: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
