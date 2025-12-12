/**
 * Jobs Controller
 * Handle async job status tracking
 */

import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Jobs')
@Controller('jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get(':jobId')
  @ApiOperation({ 
    summary: 'Get async job status',
    description: 'Check the status of an asynchronous bulk operation (e.g., bulk-status update)'
  })
  @ApiParam({ name: 'jobId', description: 'Job ID returned from bulk operations' })
  @ApiResponse({ 
    status: 200, 
    description: 'Job status',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' },
        status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] },
        progress: { 
          type: 'object',
          properties: {
            completed: { type: 'number' },
            total: { type: 'number' },
          },
        },
        errors: { type: 'array', items: { type: 'object' } },
        createdAt: { type: 'string' },
        completedAt: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.jobsService.getJobStatus(jobId);
    
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    
    return job;
  }
}
