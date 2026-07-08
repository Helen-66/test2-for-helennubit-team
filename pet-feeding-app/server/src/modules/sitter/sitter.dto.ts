import { IsString, IsNumber, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class ApplySitterDto {
  @IsString()
  realName: string;

  @IsString()
  idCardNo: string;

  @IsString()
  idCardFront: string;

  @IsString()
  idCardBack: string;

  @IsString()
  idCardHold: string;

  @IsOptional()
  @IsArray()
  certImages?: string[];

  @IsNumber()
  longitude: number;

  @IsNumber()
  latitude: number;

  @IsString()
  address: string;

  @IsArray()
  serviceItems: { name: string; price: number; unit: string }[];

  @IsOptional()
  @IsArray()
  availableTime?: { dayOfWeek: number; startTime: string; endTime: string }[];
}

export class UpdateServiceDto {
  @IsOptional()
  @IsArray()
  serviceItems?: { name: string; price: number; unit: string }[];

  @IsOptional()
  @IsArray()
  availableTime?: { dayOfWeek: number; startTime: string; endTime: string }[];

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsString()
  address?: string;
}
