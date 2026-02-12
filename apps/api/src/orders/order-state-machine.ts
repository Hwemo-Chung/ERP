import { Injectable } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';

@Injectable()
export class OrderStateMachine {
  private readonly transitions: Map<OrderStatus, OrderStatus[]> = new Map([
    [OrderStatus.UNASSIGNED, [OrderStatus.ASSIGNED]],
    [
      OrderStatus.ASSIGNED,
      [OrderStatus.CONFIRMED, OrderStatus.UNASSIGNED, OrderStatus.REQUEST_CANCEL],
    ],
    [
      OrderStatus.CONFIRMED,
      [OrderStatus.RELEASED, OrderStatus.ASSIGNED, OrderStatus.REQUEST_CANCEL],
    ],
    [
      OrderStatus.RELEASED,
      [OrderStatus.DISPATCHED, OrderStatus.CONFIRMED, OrderStatus.REQUEST_CANCEL],
    ],
    [
      OrderStatus.DISPATCHED,
      [
        OrderStatus.COMPLETED,
        OrderStatus.PARTIAL,
        OrderStatus.POSTPONED,
        OrderStatus.ABSENT,
        OrderStatus.CANCELLED,
        OrderStatus.REQUEST_CANCEL,
      ],
    ],
    [
      OrderStatus.POSTPONED,
      [
        OrderStatus.DISPATCHED,
        OrderStatus.ABSENT,
        OrderStatus.CANCELLED,
        OrderStatus.REQUEST_CANCEL,
      ],
    ],
    [
      OrderStatus.ABSENT,
      [
        OrderStatus.DISPATCHED,
        OrderStatus.POSTPONED,
        OrderStatus.CANCELLED,
        OrderStatus.REQUEST_CANCEL,
      ],
    ],
    [OrderStatus.COMPLETED, [OrderStatus.COLLECTED]],
    [OrderStatus.PARTIAL, [OrderStatus.COMPLETED, OrderStatus.COLLECTED]],
    [OrderStatus.COLLECTED, []],
    [OrderStatus.CANCELLED, []],
    [OrderStatus.REQUEST_CANCEL, [OrderStatus.CANCELLED, OrderStatus.DISPATCHED]],
  ]);

  private readonly guards: Map<string, (context: TransitionContext) => boolean> = new Map([
    [`${OrderStatus.UNASSIGNED}:${OrderStatus.ASSIGNED}`, (ctx) => !!ctx.installerId],

    [
      `${OrderStatus.CONFIRMED}:${OrderStatus.RELEASED}`,
      (ctx) => {
        const today = new Date().toISOString().split('T')[0];
        return ctx.appointmentDate === today;
      },
    ],

    [`${OrderStatus.DISPATCHED}:${OrderStatus.COMPLETED}`, (ctx) => !!ctx.serialsCaptured],

    [`${OrderStatus.DISPATCHED}:${OrderStatus.POSTPONED}`, (ctx) => !!ctx.reasonCode],

    [`${OrderStatus.DISPATCHED}:${OrderStatus.ABSENT}`, (ctx) => (ctx.retryCount || 0) < 3],

    [`${OrderStatus.DISPATCHED}:${OrderStatus.CANCELLED}`, (ctx) => !!ctx.reasonCode],

    [`${OrderStatus.COMPLETED}:${OrderStatus.COLLECTED}`, (ctx) => !!ctx.wastePickupLogged],

    [`${OrderStatus.PARTIAL}:${OrderStatus.COMPLETED}`, (ctx) => !!ctx.partialItemsResolved],

    [`${OrderStatus.PARTIAL}:${OrderStatus.COLLECTED}`, (ctx) => !!ctx.wastePickupLogged],

    [`${OrderStatus.ASSIGNED}:${OrderStatus.REQUEST_CANCEL}`, (ctx) => ctx.role === Role.INSTALLER],
    [
      `${OrderStatus.CONFIRMED}:${OrderStatus.REQUEST_CANCEL}`,
      (ctx) => ctx.role === Role.INSTALLER,
    ],
    [`${OrderStatus.RELEASED}:${OrderStatus.REQUEST_CANCEL}`, (ctx) => ctx.role === Role.INSTALLER],
    [
      `${OrderStatus.DISPATCHED}:${OrderStatus.REQUEST_CANCEL}`,
      (ctx) => ctx.role === Role.INSTALLER,
    ],

    [
      `${OrderStatus.POSTPONED}:${OrderStatus.REQUEST_CANCEL}`,
      (ctx) => ctx.role === Role.INSTALLER,
    ],
    [`${OrderStatus.ABSENT}:${OrderStatus.REQUEST_CANCEL}`, (ctx) => ctx.role === Role.INSTALLER],

    [
      `${OrderStatus.REQUEST_CANCEL}:${OrderStatus.CANCELLED}`,
      (ctx) => ctx.role === Role.HQ_ADMIN || ctx.role === Role.BRANCH_MANAGER,
    ],
  ]);

  /**
   * Check if transition is valid
   */
  canTransition(from: OrderStatus, to: OrderStatus): boolean {
    const validNextStates = this.transitions.get(from);
    return validNextStates?.includes(to) ?? false;
  }

  /**
   * Validate and perform state transition
   */
  validateTransition(
    from: OrderStatus,
    to: OrderStatus,
    context: TransitionContext,
  ): ValidationResult {
    // Check if transition is allowed
    if (!this.canTransition(from, to)) {
      return {
        valid: false,
        error: `error.invalid_status_transition`,
        errorCode: 'E2001',
        details: { from, to },
      };
    }

    // Check guard conditions
    const guardKey = `${from}:${to}`;
    const guard = this.guards.get(guardKey);

    if (guard && !guard(context)) {
      return {
        valid: false,
        error: `error.transition_guard_failed`,
        errorCode: 'E2001',
        details: { from, to, guardKey },
      };
    }

    return { valid: true };
  }

  /**
   * Get available next states from current state
   */
  getAvailableTransitions(currentStatus: OrderStatus): OrderStatus[] {
    return this.transitions.get(currentStatus) || [];
  }

  /**
   * Check if status is terminal (no further transitions allowed)
   */
  isTerminalState(status: OrderStatus): boolean {
    const nextStates = this.transitions.get(status);
    return !nextStates || nextStates.length === 0;
  }

  /**
   * Validate revert rules per PRD specification
   * - Revert to 미처리: within 당일+5 days
   * - Appointment change: within 최초약속일+15 days
   */
  canRevert(
    completedAt: Date,
    originalPromisedDate: Date,
    newAppointmentDate?: Date,
  ): ValidationResult {
    const now = new Date();
    const daysSinceCompletion = Math.floor(
      (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Revert window: +5 days from completion
    if (daysSinceCompletion > 5) {
      return {
        valid: false,
        error: 'error.revert_window_exceeded',
        errorCode: 'E2003',
        details: { daysSinceCompletion, maxDays: 5 },
      };
    }

    // Appointment change window: +15 days from original promised date
    if (newAppointmentDate) {
      const daysSincePromised = Math.floor(
        (newAppointmentDate.getTime() - originalPromisedDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSincePromised > 15) {
        return {
          valid: false,
          error: 'error.appointment_date_exceeded',
          errorCode: 'E2003',
          details: { daysSincePromised, maxDays: 15 },
        };
      }
    }

    return { valid: true };
  }
}

export interface TransitionContext {
  installerId?: string;
  appointmentDate?: string;
  serialsCaptured?: boolean;
  reasonCode?: string;
  retryCount?: number;
  wastePickupLogged?: boolean;
  partialItemsResolved?: boolean;
  role?: Role;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
  details?: Record<string, unknown>;
}
