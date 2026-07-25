import { Matches } from 'class-validator';

export class YearMonthDto {
  @Matches(/^\d{4}-\d{2}$/, { message: 'yearMonth must match YYYY-MM' })
  yearMonth!: string;
}
