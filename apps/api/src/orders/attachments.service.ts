/**
 * Attachments Service
 * Handles file upload, storage, and retrieval for order attachments
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MAX_ATTACHMENTS = 10;
  private readonly ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'application/pdf',
  ];
  private readonly UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

  constructor(private readonly prisma: PrismaService) {
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await mkdir(this.UPLOAD_DIR, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create upload directory', error);
    }
  }

  /**
   * Upload attachment for an order
   */
  async uploadAttachment(
    orderId: string,
    file: Express.Multer.File,
    userId: string,
    _description?: string,
  ) {
    // Validate order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        _count: {
          select: { attachments: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Check max attachments limit
    if (order._count.attachments >= this.MAX_ATTACHMENTS) {
      throw new BadRequestException(
        `Maximum ${this.MAX_ATTACHMENTS} attachments allowed per order`,
      );
    }

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Validate file type
    if (!this.ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} not allowed. Allowed types: ${this.ALLOWED_TYPES.join(', ')}`,
      );
    }

    // Generate unique filename
    const ext = path.extname(file.originalname);
    const filename = `${orderId}_${Date.now()}${ext}`;
    const filepath = path.join(this.UPLOAD_DIR, filename);

    // Save file to disk
    await writeFile(filepath, file.buffer);

    // Create attachment record
    const attachment = await this.prisma.attachment.create({
      data: {
        orderId,
        fileName: file.originalname,
        storageKey: filepath,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedBy: userId,
      },
    });

    this.logger.log(`Attachment ${attachment.id} uploaded for order ${orderId}`);

    return {
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      url: `/api/orders/${orderId}/attachments/${attachment.id}`,
      uploadedAt: attachment.uploadedAt,
    };
  }

  /**
   * Get all attachments for an order
   */
  async getAttachments(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    const attachments = await this.prisma.attachment.findMany({
      where: { orderId },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        uploadedAt: true,
        uploadedBy: true,
      },
    });

    return attachments.map((att) => ({
      ...att,
      url: `/api/orders/${orderId}/attachments/${att.id}`,
    }));
  }

  /**
   * Get single attachment
   */
  async getAttachment(orderId: string, attachmentId: string) {
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        orderId,
      },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    return attachment;
  }

  /**
   * Delete attachment
   */
  async deleteAttachment(orderId: string, attachmentId: string, userId: string) {
    const attachment = await this.getAttachment(orderId, attachmentId);

    // Delete file from disk
    try {
      await unlink(attachment.storageKey);
    } catch (error) {
      this.logger.warn(`Failed to delete file ${attachment.storageKey}`, error);
    }

    // Delete database record
    await this.prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        actor: userId,
        action: 'DELETE',
        tableName: 'attachments',
        recordId: attachmentId,
        diff: {
          orderId,
          fileName: attachment.fileName,
        },
      },
    });

    this.logger.log(`Attachment ${attachmentId} deleted from order ${orderId}`);

    return { success: true };
  }
}
