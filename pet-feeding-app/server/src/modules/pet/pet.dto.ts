import { IsString, IsOptional, IsNumber, IsArray, IsInt } from 'class-validator';

export class CreatePetDto {
  @IsString()
  name: string;

  @IsString()
  species: string;

  @IsOptional()
  @IsString()
  breed?: string;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsString()
  age?: string;

  @IsOptional()
  @IsInt()
  gender?: number;

  @IsOptional()
  @IsString()
  characterDesc?: string;

  @IsOptional()
  @IsString()
  feedingNotes?: string;

  @IsOptional()
  @IsArray()
  photos?: string[];
}

export class UpdatePetDto extends CreatePetDto {
  @IsInt()
  id: number;
}
