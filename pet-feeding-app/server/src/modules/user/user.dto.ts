import { IsString, IsOptional } from 'class-validator';

export class WxLoginDto {
  @IsString()
  code: string;
}

export class BindPhoneDto {
  @IsString()
  code: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
