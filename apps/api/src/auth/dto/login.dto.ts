import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'branch01', description: 'Username' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: '••••', description: 'Password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  password!: string;
}
