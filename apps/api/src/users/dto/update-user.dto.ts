import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, ValidateIf } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: 'Current password (required when changing password)',
    example: 'CurrentPass123!',
    required: false,
  })
  @ValidateIf((o) => o.password !== undefined)
  @IsString()
  @IsNotEmpty({
    message: 'Current password is required when changing password',
  })
  currentPassword?: string;
}
