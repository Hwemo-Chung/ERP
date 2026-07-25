import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExcelImportService } from './excel-import.service';
import { CommitPartnersDto, CommitProductsDto } from './dto/excel-import-commit.dto';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

@ApiTags('MasterData')
@Controller('master-data/import')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(Role.HQ_ADMIN)
export class ExcelImportController {
  constructor(private readonly service: ExcelImportService) {}

  @Post('partners/parse')
  @ApiOperation({ summary: 'Parse an uploaded partner xlsx into valid/invalid rows' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, mapping: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  async parsePartners(@UploadedFile() file: Express.Multer.File, @Body('mapping') mappingRaw: string) {
    this.assertXlsx(file);
    const mapping = this.parseMapping(mappingRaw);
    return this.parseOrBadRequest(() => this.service.parsePartners(file.buffer, mapping));
  }

  @Post('partners/commit')
  @ApiOperation({ summary: 'Commit previously parsed valid partner rows' })
  async commitPartners(@Body() dto: CommitPartnersDto) {
    return this.service.commitPartners(dto.rows, dto.defaultStorageContract);
  }

  @Post('products/parse')
  @ApiOperation({ summary: 'Parse an uploaded product xlsx into valid/invalid rows' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, mapping: { type: 'string' } } } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  async parseProducts(@UploadedFile() file: Express.Multer.File, @Body('mapping') mappingRaw: string) {
    this.assertXlsx(file);
    const mapping = this.parseMapping(mappingRaw);
    return this.parseOrBadRequest(() => this.service.parseProducts(file.buffer, mapping));
  }

  @Post('products/commit')
  @ApiOperation({ summary: 'Commit previously parsed valid product rows' })
  async commitProducts(@Body() dto: CommitProductsDto) {
    return this.service.commitProducts(dto.rows, dto.defaultPartnerId);
  }

  private parseMapping(mappingRaw: string): Record<string, string> {
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

  // ponytail: extension is the authoritative signal for xlsx — browsers/OSes report
  // wildly inconsistent mimetypes for .xlsx (application/octet-stream,
  // application/vnd.ms-excel, application/x-zip-compressed on Windows), so checking
  // mimetype too would false-positive-reject real xlsx uploads from real clients.
  private assertXlsx(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException({ code: 'E4001', message: 'file required' });
    if (!file.originalname?.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException({ code: 'E4001', message: 'only .xlsx files are supported' });
    }
  }

  /** exceljs throws on a corrupt/renamed-but-not-actually-xlsx buffer — surface as 400, not 500. */
  private async parseOrBadRequest<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException({ code: 'E4001', message: 'invalid xlsx file' });
    }
  }
}
