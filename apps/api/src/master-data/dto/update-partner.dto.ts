import { IsEnum, IsOptional } from 'class-validator';
import { PartialType, OmitType } from '@nestjs/swagger';
import { AreaBillingMode } from '@prisma/client';
import { CreatePartnerDto } from './create-partner.dto';

// code is immutable after creation; storageContract has its own dedicated flow (not part of PATCH).
export class UpdatePartnerDto extends PartialType(
  OmitType(CreatePartnerDto, ['code', 'storageContract'] as const),
) {
  // ponytail: no storage-contract update endpoint exists yet (see partner-form.page.ts —
  // "보관계약은 이 화면에서 변경할 수 없습니다"), so this is validated but not yet persisted —
  // PartnersService.update strips it before the Partner-model write. Wire up when a contract
  // edit flow ships.
  @IsOptional() @IsEnum(AreaBillingMode) areaBillingMode?: AreaBillingMode;
}
