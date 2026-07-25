import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

// code is immutable after creation.
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['code'] as const)) {}
