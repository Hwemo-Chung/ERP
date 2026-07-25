import { BadRequestException } from '@nestjs/common';

// ponytail: extracted from master-data/excel-import.controller.ts (Task 12) when
// warehouse/transactions.controller.ts (Task 13) needed the identical upload-validation
// trio. Two call sites is the point where "reuse the file a few lines over" (ladder rung 2)
// beats copy-pasting a third private-method block.
export const MAX_XLSX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Extension is the authoritative signal for xlsx — browsers/OSes report wildly inconsistent
 * mimetypes for .xlsx (application/octet-stream, application/vnd.ms-excel,
 * application/x-zip-compressed on Windows), so checking mimetype too would false-positive-reject
 * real xlsx uploads from real clients.
 */
export function assertXlsxFile(file?: Express.Multer.File): void {
  if (!file) throw new BadRequestException({ code: 'E4001', message: 'file required' });
  if (!file.originalname?.toLowerCase().endsWith('.xlsx')) {
    throw new BadRequestException({ code: 'E4001', message: 'only .xlsx files are supported' });
  }
}

export function parseImportMapping(mappingRaw: string): Record<string, string> {
  if (!mappingRaw) throw new BadRequestException({ code: 'E4001', message: 'invalid mapping' });
  try {
    const parsed = JSON.parse(mappingRaw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed;
  } catch {
    throw new BadRequestException({ code: 'E4001', message: 'invalid mapping' });
  }
}

/** exceljs throws on a corrupt/renamed-but-not-actually-xlsx buffer — surface as 400, not 500. */
export async function parseXlsxOrBadRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException({ code: 'E4001', message: 'invalid xlsx file' });
  }
}
