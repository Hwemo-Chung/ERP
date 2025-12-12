/**
 * 파일 첨부 관련 데이터 모델
 */

export interface FileAttachment {
  id: string;
  orderId: string;
  fileName: string;
  fileType: string;
  fileSize: number; // bytes
  base64Data: string; // Base64 encoded file content
  uploadedAt: number; // timestamp
  uploadedBy?: string;
  category?: 'invoice' | 'delivery' | 'receipt' | 'photo' | 'other';
  isImage: boolean;
  thumbnailUrl?: string; // Data URL for image preview
}

export interface FileUploadRequest {
  fileName: string;
  fileType: string;
  base64Data: string;
  fileSize: number;
  category?: 'invoice' | 'delivery' | 'receipt' | 'photo' | 'other';
}

export interface FileUploadResponse {
  success: boolean;
  fileId?: string;
  message?: string;
  error?: string;
}

export interface FileCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1 (0.7 for 70%)
  mimeType?: string; // 'image/jpeg' or 'image/webp'
}

export interface FileCompressionResult {
  success: boolean;
  base64Data?: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // percentage reduced
}
