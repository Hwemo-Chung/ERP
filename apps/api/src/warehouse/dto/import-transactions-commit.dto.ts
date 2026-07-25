import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

export class CommitTransactionsDto {
  // ponytail: validate each row against CreateTransactionDto (same @IsEnum/@IsUUID/@Min(1)/
  // @IsDateString rules the normal POST endpoint enforces) instead of accepting
  // Record<string, unknown> — /import/commit is reachable directly without going through
  // /import/parse first, and an unvalidated row (e.g. negative quantity) would flow straight
  // into TransactionsService.create and poison settlement calculations (pallet-days, transport
  // counts). parse()'s validRows carry exactly these 5 fields, so whitelist:true won't reject them.
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDto)
  rows!: CreateTransactionDto[];
}
