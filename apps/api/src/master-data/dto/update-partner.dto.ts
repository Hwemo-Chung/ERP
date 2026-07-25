import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePartnerDto } from './create-partner.dto';

// code is immutable after creation; storageContract has its own dedicated flow (not part of PATCH).
export class UpdatePartnerDto extends PartialType(
  OmitType(CreatePartnerDto, ['code', 'storageContract'] as const),
) {}
