import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsDefined, IsUUID, ValidateNested } from 'class-validator';
import { StorageContractDto } from './create-partner.dto';

export class CommitPartnersDto {
  @IsArray() @ArrayNotEmpty() rows!: Record<string, unknown>[];
  @IsDefined() @ValidateNested() @Type(() => StorageContractDto)
  defaultStorageContract!: StorageContractDto;
}

export class CommitProductsDto {
  @IsArray() @ArrayNotEmpty() rows!: Record<string, unknown>[];
  // products.partnerId is NOT NULL in the DB but excel rows never carry a partner UUID —
  // the upload screen collects one partner for the whole batch, same policy as
  // CommitPartnersDto.defaultStorageContract.
  @IsUUID() defaultPartnerId!: string;
}
