import { IsDateString, IsInt, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @IsOptional() @IsString() @MaxLength(30) code?: string;
  @IsString() @MaxLength(200) name!: string;
  @IsUUID() categoryId!: string;
  @IsUUID() partnerId!: string;
  @IsNumberString() unitPrice!: string;
  @IsNumberString() costPrice!: string;
  @IsOptional() @IsNumberString() transportRate?: string;
  @IsOptional() @IsNumberString() palletThreshold?: string; // %
  @IsOptional() @IsInt() @Min(1) maxUnitsPerPallet?: number;
  // P0-1: 요율 히스토리 행의 effectiveFrom. 미입력 시 서비스에서 오늘 날짜로 기본값 처리.
  @IsOptional() @IsDateString() rateEffectiveFrom?: string;
}
