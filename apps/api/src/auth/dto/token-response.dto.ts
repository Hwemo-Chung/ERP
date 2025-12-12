import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserInfoDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ enum: Role, isArray: true })
  roles!: Role[];

  @ApiProperty({ required: false })
  branchCode?: string;

  @ApiProperty()
  locale!: string;
}

export class TokenResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ description: 'Token expiration in seconds' })
  expiresIn!: number;

  @ApiProperty({ type: UserInfoDto })
  user!: UserInfoDto;
}
