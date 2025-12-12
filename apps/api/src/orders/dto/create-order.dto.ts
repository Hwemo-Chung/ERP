import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderLineDto {
  @ApiProperty({ example: 'ITEM001' })
  @IsString()
  @IsNotEmpty()
  itemCode!: string;

  @ApiProperty({ example: 'Samsung Refrigerator RT38K5039SL' })
  @IsString()
  @IsNotEmpty()
  itemName!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  quantity!: number;

  @ApiPropertyOptional({ example: 85.5 })
  @IsOptional()
  @IsNumber()
  weight?: number;
}

export class AddressDto {
  @ApiProperty({ example: '서울시 강남구 테헤란로 123' })
  @IsString()
  @IsNotEmpty()
  line1!: string;

  @ApiPropertyOptional({ example: '아파트 101동 202호' })
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty({ example: '서울시' })
  @IsString()
  city!: string;

  @ApiProperty({ example: '06142' })
  @IsString()
  postal!: string;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'SO2025121001' })
  @IsString()
  @IsNotEmpty()
  orderNo!: string;

  @ApiProperty({ example: '김철수' })
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @ApiProperty({ example: '010-1234-5678' })
  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @ApiProperty({ type: AddressDto })
  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @ApiProperty({ example: '동부대우전자' })
  @IsString()
  @IsNotEmpty()
  vendor!: string;

  @ApiProperty({ description: 'Branch ID' })
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @ApiProperty({ example: '2025-12-15' })
  @IsString()
  @IsNotEmpty()
  appointmentDate!: string;

  @ApiPropertyOptional({ example: '2025-12-15' })
  @IsOptional()
  @IsString()
  promisedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ type: [OrderLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];
}
