import { IsUUID, Matches } from 'class-validator';

export class GetStatementDto {
  @IsUUID()
  partnerId!: string;

  @Matches(/^\d{4}-\d{2}$/, { message: 'yearMonth must match YYYY-MM' })
  yearMonth!: string;
}
