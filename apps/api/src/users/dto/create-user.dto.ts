import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEmail,
  IsOptional,
  IsEnum,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({
    description: 'Username for login',
    example: 'john_doe',
    minLength: 4,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username can only contain letters, numbers, underscores, and hyphens',
  })
  username!: string;

  @ApiProperty({
    description: 'Password (min 8 characters, must include uppercase, lowercase, number, and special character)',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password!: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @ApiProperty({
    description: 'Full name',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.INSTALLER,
  })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;

  @ApiProperty({
    description: 'Branch ID (required for BRANCH_MANAGER and INSTALLER roles)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @ValidateIf(
    (o) =>
      o.role === Role.BRANCH_MANAGER ||
      o.role === Role.INSTALLER ||
      o.branchId !== undefined,
  )
  @IsUUID()
  @IsNotEmpty({
    message: 'Branch ID is required for BRANCH_MANAGER and INSTALLER roles',
  })
  branchId?: string;

  @ApiProperty({
    description: 'Phone number (Korean format)',
    example: '010-1234-5678',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/, {
    message: 'Phone number must be in Korean mobile format (e.g., 010-1234-5678 or 01012345678)',
  })
  phoneNumber?: string;
}
