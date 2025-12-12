/**
 * Jobs Service
 * Track status of async bulk operations
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface JobProgress {
  completed: number;
  total: number;
}

interface JobError {
  orderId: string;
  error: string;
}

export interface JobStatus {
  jobId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  progress: JobProgress;
  errors: JobError[];
  createdAt: Date;
  completedAt: Date | null;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  // In production, this would be stored in Redis
  private jobs: Map<string, JobStatus> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new job
   */
  async createJob(total: number): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const job: JobStatus = {
      jobId,
      status: 'PENDING',
      progress: { completed: 0, total },
      errors: [],
      createdAt: new Date(),
      completedAt: null,
    };

    this.jobs.set(jobId, job);
    this.logger.log(`Job created: ${jobId} with ${total} items`);

    return jobId;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(
    jobId: string,
    completed: number,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
    error?: JobError,
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      this.logger.warn(`Job ${jobId} not found for update`);
      return;
    }

    job.status = status;
    job.progress.completed = completed;

    if (error) {
      job.errors.push(error);
    }

    if (status === 'COMPLETED' || status === 'FAILED') {
      job.completedAt = new Date();
    }

    this.jobs.set(jobId, job);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = this.jobs.get(jobId);
    
    if (!job) {
      this.logger.debug(`Job ${jobId} not found`);
      return null;
    }

    return job;
  }

  /**
   * Delete old completed jobs (cleanup)
   * Should be called periodically
   */
  async cleanupOldJobs(olderThan: Date): Promise<number> {
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        job.completedAt &&
        job.completedAt < olderThan &&
        (job.status === 'COMPLETED' || job.status === 'FAILED')
      ) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} old jobs`);
    }

    return cleaned;
  }
}
