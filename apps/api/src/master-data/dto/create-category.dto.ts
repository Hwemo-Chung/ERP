import { IsString, IsOptional, MaxLength, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsUUID() parentId?: string;
}

export class RenameCategoryDto {
  @IsString() @MaxLength(120) name!: string;
}
