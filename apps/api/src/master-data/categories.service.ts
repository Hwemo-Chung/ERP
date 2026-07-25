import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    let depth = 1;
    let parentCode: string | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException({ code: 'E4104', message: 'parent category not found' });
      if (parent.depth >= 3) throw new BadRequestException({ code: 'E4105', message: 'max category depth is 3' });
      depth = parent.depth + 1;
      parentCode = parent.code;
    }
    const code = await this.nextCode(depth, parentCode, dto.parentId ?? null);
    return this.prisma.category.create({
      data: { name: dto.name, parentId: dto.parentId ?? null, depth, code },
    });
  }

  private async nextCode(depth: number, parentCode: string | null, parentId: string | null): Promise<string> {
    const lastSibling = await this.prisma.category.findFirst({
      where: { parentId },
      orderBy: { code: 'desc' },
    });
    if (depth === 1) {
      // ponytail: A-Z only (26 roots); switch to base-26 (AA, AB, ...) if that overflows.
      return lastSibling ? String.fromCharCode(lastSibling.code.charCodeAt(0) + 1) : 'A';
    }
    const width = depth === 2 ? 2 : 3;
    const lastSeq = lastSibling ? parseInt(lastSibling.code.split('-').pop()!, 10) : 0;
    return `${parentCode}-${String(lastSeq + 1).padStart(width, '0')}`;
  }

  async findTree() {
    // ponytail: no cascade on deactivate — an active child of a deactivated parent still
    // exists in the DB but silently drops out of this tree. Add cascading deactivate if
    // that gap matters.
    const all = await this.prisma.category.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    const byParent = new Map<string | null, typeof all>();
    for (const c of all) {
      const key = c.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(c);
    }
    const build = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((c) => ({ ...c, children: build(c.id) }));
    return build(null);
  }

  async rename(id: string, name: string) {
    await this.assertExists(id);
    return this.prisma.category.update({ where: { id }, data: { name } });
  }

  async deactivate(id: string) {
    await this.assertExists(id);
    return this.prisma.category.update({ where: { id }, data: { isActive: false } });
  }

  private async assertExists(id: string) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'E4104', message: 'category not found' });
  }
}
