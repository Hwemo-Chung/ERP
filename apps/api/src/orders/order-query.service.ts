import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GetOrdersDto } from './dto/get-orders.dto';

@Injectable()
export class OrderQueryService {
  private readonly logger = new Logger(OrderQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: GetOrdersDto, branchCode?: string) {
    const where = this.buildWhereClause(dto, branchCode);
    const { take, skip, cursor } = this.buildPagination(dto);

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        take: take + 1,
        skip,
        cursor,
        orderBy: [{ appointmentDate: dto.sortDirection || 'asc' }, { createdAt: 'desc' }],
        include: {
          branch: { select: { code: true, name: true } },
          partner: { select: { code: true, name: true } },
          installer: { select: { id: true, name: true, phone: true } },
          lines: true,
          _count: { select: { attachments: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return this.buildPaginationResult(orders, total, take, dto.page);
  }

  async getStats(branchCode?: string) {
    const where = this.buildBranchFilter(branchCode);

    const [total, unassigned, assigned, confirmed, released, dispatched, completed, cancelled] =
      await Promise.all([
        this.prisma.order.count({ where }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.UNASSIGNED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.ASSIGNED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.CONFIRMED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.RELEASED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.DISPATCHED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.COMPLETED } }),
        this.prisma.order.count({ where: { ...where, status: OrderStatus.CANCELLED } }),
      ]);

    return {
      total,
      unassigned,
      assigned,
      confirmed,
      released,
      dispatched,
      completed,
      cancelled,
      pending: unassigned,
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: {
        branch: true,
        partner: true,
        installer: true,
        lines: {
          include: {
            serialNumbers: true,
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 20,
          include: { user: { select: { fullName: true } } },
        },
        appointments: {
          orderBy: { changedAt: 'desc' },
          take: 10,
        },
        wastePickups: true,
        attachments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('error.order_not_found');
    }

    return order;
  }

  async findAndValidateOrder<T extends object>(
    tx: Prisma.TransactionClient,
    id: string,
    options: {
      include?: Prisma.OrderInclude;
      expectedVersion?: number;
      validStatuses?: OrderStatus[];
      invalidStatuses?: OrderStatus[];
      errorContext?: string;
    },
  ): Promise<T> {
    const order = await tx.order.findUnique({
      where: { id },
      include: options.include,
    });

    if (!order) {
      throw new NotFoundException({ code: 'E2001', message: 'Order not found' });
    }

    if (order.deletedAt) {
      throw new NotFoundException({ code: 'E2001', message: 'Order has been deleted' });
    }

    if (options.expectedVersion !== undefined && order.version !== options.expectedVersion) {
      throw new ConflictException({
        code: 'E2017',
        message: 'Order version mismatch',
        expectedVersion: options.expectedVersion,
        currentVersion: order.version,
      });
    }

    if (options.validStatuses && !options.validStatuses.includes(order.status)) {
      throw new BadRequestException({
        code: 'E2018',
        message: `Cannot ${options.errorContext || 'perform action on'} order with status ${order.status}`,
        currentStatus: order.status,
      });
    }

    if (options.invalidStatuses && options.invalidStatuses.includes(order.status)) {
      throw new BadRequestException({
        code: 'E2018',
        message: `Cannot ${options.errorContext || 'perform action on'} order with status ${order.status}`,
        currentStatus: order.status,
      });
    }

    return order as T;
  }

  private buildWhereClause(dto: GetOrdersDto, branchCode?: string): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = { deletedAt: null };

    const effectiveBranchCode = dto.branchCode || branchCode;
    if (effectiveBranchCode && effectiveBranchCode !== 'ALL') {
      where.branch = { code: effectiveBranchCode };
    }

    if (dto.status) where.status = dto.status;
    if (dto.installerId) where.installerId = dto.installerId;
    if (dto.customerName) {
      where.customerName = { contains: dto.customerName, mode: 'insensitive' };
    }
    if (dto.vendor) where.vendor = dto.vendor;

    if (dto.appointmentDateFrom || dto.appointmentDateTo) {
      where.appointmentDate = {
        ...(dto.appointmentDateFrom && { gte: new Date(dto.appointmentDateFrom) }),
        ...(dto.appointmentDateTo && { lte: new Date(dto.appointmentDateTo) }),
      };
    }

    return where;
  }

  private buildBranchFilter(branchCode?: string): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = { deletedAt: null };
    if (branchCode && branchCode !== 'ALL') {
      where.branch = { code: branchCode };
    }
    return where;
  }

  private buildPagination(dto: GetOrdersDto): {
    take: number;
    skip: number;
    cursor: { id: string } | undefined;
  } {
    const take = dto.limit || 20;
    let skip = 0;
    let cursor: { id: string } | undefined;

    if (dto.cursor) {
      skip = 1;
      cursor = { id: dto.cursor };
    } else if (dto.page && dto.page > 1) {
      skip = (dto.page - 1) * take;
    }

    return { take, skip, cursor };
  }

  private buildPaginationResult<T extends { id: string }>(
    orders: T[],
    total: number,
    take: number,
    page?: number,
  ) {
    const hasMore = orders.length > take;
    const data = hasMore ? orders.slice(0, take) : orders;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        totalCount: total,
        total,
        page: page || 1,
        limit: take,
      },
    };
  }
}
