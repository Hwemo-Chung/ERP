import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Username',
    example: 'john_doe',
  })
  username!: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
    required: false,
  })
  email?: string;

  @ApiProperty({
    description: 'Full name',
    example: 'John Doe',
  })
  name!: string;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.INSTALLER,
  })
  role!: Role;

  @ApiProperty({
    description: 'User roles (multiple roles support)',
    enum: Role,
    isArray: true,
    example: [Role.INSTALLER],
    required: false,
  })
  roles?: Role[];

  @ApiProperty({
    description: 'Branch ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  branchId?: string;

  @ApiProperty({
    description: 'Partner ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  partnerId?: string;

  @ApiProperty({
    description: 'Whether the user is active',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Phone number',
    example: '010-1234-5678',
    required: false,
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'User creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'User last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: Date;
}
