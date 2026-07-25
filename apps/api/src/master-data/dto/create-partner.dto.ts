import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumberString,
  IsDateString,
  ValidateNested,
  IsDefined,
  MaxLength,
} from 'class-validator';
import { StorageContractType, AreaBillingMode } from '@prisma/client';

export class StorageContractDto {
  @IsEnum(StorageContractType) contractType!: StorageContractType;
  @IsOptional() @IsNumberString() palletDailyRate?: string;
  @IsOptional() @IsNumberString() areaPyeong?: string;
  @IsOptional() @IsNumberString() areaRate?: string;
  @IsOptional() @IsEnum(AreaBillingMode) areaBillingMode?: AreaBillingMode; // 면적 계약(AREA_*)에만 의미, default FULL_MONTH
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class CreatePartnerDto {
  @IsOptional() @IsString() @MaxLength(20) code?: string; // 엑셀 기존 코드, 없으면 자동채번
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() businessRegistrationNo?: string;
  @IsOptional() @IsString() representativeName?: string;
  @IsOptional() @IsString() businessType?: string;
  @IsOptional() @IsString() businessCategory?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsNumberString() defaultTransportRate?: string;
  @IsDefined() @ValidateNested() @Type(() => StorageContractDto)
  storageContract!: StorageContractDto;
}
