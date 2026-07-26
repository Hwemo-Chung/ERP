import { IsString, IsOptional, IsNumberString, IsDateString, MaxLength } from 'class-validator';

export class CreateRateCardDto {
  @IsString() @MaxLength(60) vehicleType!: string;
  @IsOptional() @IsNumberString() tonnage?: string;
  @IsOptional() @IsString() @MaxLength(40) containerSize?: string;
  @IsOptional() @IsString() @MaxLength(60) specialEquipment?: string;
  @IsNumberString() rate!: string;
  // P0-1: 요율 히스토리 행의 effectiveFrom. 미입력 시 서비스에서 오늘 날짜로 기본값 처리.
  @IsOptional() @IsDateString() rateEffectiveFrom?: string;
}
