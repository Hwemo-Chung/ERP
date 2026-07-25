import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaMock = {
  category: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = module.get(CategoriesService);
  });

  it('assigns code A to first root category', async () => {
    prismaMock.category.findFirst.mockResolvedValue(null);
    prismaMock.category.create.mockResolvedValue({});
    await service.create({ name: '가전' });
    expect(prismaMock.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'A', depth: 1 }) }),
    );
  });

  it('assigns code B when A exists', async () => {
    prismaMock.category.findFirst.mockResolvedValue({ code: 'A' });
    prismaMock.category.create.mockResolvedValue({});
    await service.create({ name: '가구' });
    expect(prismaMock.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'B' }) }),
    );
  });

  it('assigns A-01 to first child of A', async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: 'a', code: 'A', depth: 1 });
    prismaMock.category.findFirst.mockResolvedValue(null);
    prismaMock.category.create.mockResolvedValue({});
    await service.create({ name: '대형가전', parentId: 'a' });
    expect(prismaMock.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'A-01', depth: 2 }) }),
    );
  });

  it('assigns A-01-003 style at depth 3, increments sibling', async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: 'a01', code: 'A-01', depth: 2 });
    prismaMock.category.findFirst.mockResolvedValue({ code: 'A-01-002' });
    prismaMock.category.create.mockResolvedValue({});
    await service.create({ name: '냉장고', parentId: 'a01' });
    expect(prismaMock.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'A-01-003', depth: 3 }) }),
    );
  });

  it('rejects depth 4 with E4105', async () => {
    prismaMock.category.findUnique.mockResolvedValue({ id: 'x', code: 'A-01-003', depth: 3 });
    await expect(service.create({ name: '깊음', parentId: 'x' })).rejects.toThrow(BadRequestException);
  });
});
