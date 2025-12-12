import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 이미지 최적화 서비스
 * 
 * 기능:
 * - 이미지 리사이징 (1024px 최대)
 * - WebP 포맷 변환
 * - 품질 조정 (70% 기본)
 * - 캐싱 (LocalStorage)
 */

export interface OptimizedImage {
  id: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number; // percentage
  format: 'webp' | 'jpeg';
  url: string; // Data URL
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class ImageOptimizationService {
  private readonly cache = new BehaviorSubject<Map<string, OptimizedImage>>(
    this.loadCache()
  );
  private readonly MAX_CACHE_SIZE = 50; // 최대 50개 이미지
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30일

  constructor() {}

  /**
   * 이미지 최적화 (메인 메서드)
   */
  async optimizeImage(
    file: File,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: 'webp' | 'jpeg';
    } = {}
  ): Promise<OptimizedImage> {
    const {
      maxWidth = 1024,
      maxHeight = 1024,
      quality = 0.7,
      format = 'webp',
    } = options;

    // 캐시 확인
    const cacheKey = `${file.name}-${file.size}-${file.lastModified}`;
    const cached = this.cache.value.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();

        img.onload = () => {
          const optimized = this.resizeAndCompress(
            img,
            file,
            maxWidth,
            maxHeight,
            quality,
            format,
            cacheKey
          );
          resolve(optimized);
        };

        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };

        img.src = event.target?.result as string;
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * 이미지 리사이징 및 압축
   */
  private resizeAndCompress(
    img: HTMLImageElement,
    originalFile: File,
    maxWidth: number,
    maxHeight: number,
    quality: number,
    format: 'webp' | 'jpeg',
    cacheKey: string
  ): OptimizedImage {
    const canvas = document.createElement('canvas');
    let { width, height } = img;

    // 종횡비 유지하며 리사이징
    if (width > height) {
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context not available');
    }

    ctx.drawImage(img, 0, 0, width, height);

    // Data URL로 변환
    const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';
    const url = canvas.toDataURL(mimeType, quality);

    // 크기 계산
    const optimizedSize = this.estimateBase64Size(url);
    const compressionRatio =
      ((originalFile.size - optimizedSize) / originalFile.size) * 100;

    const result: OptimizedImage = {
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalSize: originalFile.size,
      optimizedSize,
      compressionRatio: Math.round(compressionRatio),
      format,
      url,
      timestamp: Date.now(),
    };

    // 캐시에 저장
    this.addToCache(cacheKey, result);

    return result;
  }

  /**
   * 캐시에 이미지 추가
   */
  private addToCache(key: string, image: OptimizedImage): void {
    const cache = this.cache.value;
    cache.set(key, image);

    // 캐시 크기 제한 (FIFO)
    if (cache.size > this.MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    this.cache.next(cache);
    this.saveCache(cache);
  }

  /**
   * LocalStorage에 캐시 저장
   */
  private saveCache(cache: Map<string, OptimizedImage>): void {
    try {
      const data = JSON.stringify(Array.from(cache.entries()));
      localStorage.setItem('image-optimization-cache', data);
    } catch (error) {
      console.warn('Failed to save image cache:', error);
    }
  }

  /**
   * LocalStorage에서 캐시 로드
   */
  private loadCache(): Map<string, OptimizedImage> {
    try {
      const data = localStorage.getItem('image-optimization-cache');
      if (data) {
        return new Map(JSON.parse(data));
      }
    } catch (error) {
      console.warn('Failed to load image cache:', error);
    }
    return new Map();
  }

  /**
   * Base64 크기 추정
   */
  private estimateBase64Size(base64String: string): number {
    const length = base64String.replace(/[=]/g, '').length;
    return Math.floor((length * 3) / 4);
  }

  /**
   * 캐시 조회 (Observable)
   */
  getCache$(): Observable<OptimizedImage[]> {
    return this.cache.pipe(map((map) => Array.from(map.values())));
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cache.next(new Map());
    localStorage.removeItem('image-optimization-cache');
  }
}
