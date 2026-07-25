import { IsString, IsOptional, IsNumberString, MaxLength } from 'class-validator';

export class CreateRateCardDto {
  @IsString() @MaxLength(60) vehicleType!: string;
  @IsOptional() @IsNumberString() tonnage?: string;
  @IsOptional() @IsString() @MaxLength(40) containerSize?: string;
  @IsOptional() @IsString() @MaxLength(60) specialEquipment?: string;
  @IsNumberString() rate!: string;
}
