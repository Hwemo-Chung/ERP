import { IsInt, IsNumberString, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

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
}
