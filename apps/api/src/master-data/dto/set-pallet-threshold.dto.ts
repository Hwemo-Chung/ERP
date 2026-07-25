import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SetPalletThresholdDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100) value!: number;
}
