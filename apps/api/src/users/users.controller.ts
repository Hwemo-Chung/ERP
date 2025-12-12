import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({ name: 'branchId', required: false })
  findAll(@Query('branchId') branchId?: string) {
    return this.usersService.findAll(branchId);
  }

  @Get(':id')
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
