import { IsIn, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateInvoiceStatusDto {
  @IsIn(['ISSUED', 'PAID', 'CANCELLED']) status!: 'ISSUED' | 'PAID' | 'CANCELLED';
  @ValidateIf((dto: UpdateInvoiceStatusDto) => dto.status === 'CANCELLED')
  @IsString()
  @MaxLength(300)
  cancelReason?: string;
}
