import { Injectable, BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

/**
 * Order state machine based on ARCHITECTURE.md specification
 * Controls valid state transitions for orders
 */
@Injectable()
export class OrderStateMachine {
  /**
   * Valid state transitions map
   * Key: current state, Value: array of valid next states
   */
  private readonly transitions: Map<OrderStatus, OrderStatus[]> = new Map([
    [OrderStatus.UNASSIGNED, [OrderStatus.ASSIGNED]],
    [OrderStatus.ASSIGNED, [OrderStatus.CONFIRMED, OrderStatus.UNASSIGNED]],
    [OrderStatus.CONFIRMED, [OrderStatus.RELEASED, OrderStatus.ASSIGNED]],
    [OrderStatus.RELEASED, [OrderStatus.DISPATCHED, OrderStatus.CONFIRMED]],
    [
      OrderStatus.DISPATCHED,
      [
        OrderStatus.COMPLETED,
        OrderStatus.PARTIAL,
        OrderStatus.POSTPONED,
        OrderStatus.ABSENT,
        OrderStatus.CANCELLED,
      ],
    ],
    [OrderStatus.POSTPONED, [OrderStatus.DISPATCHED, OrderStatus.ABSENT, OrderStatus.CANCELLED]],
    [OrderStatus.ABSENT, [OrderStatus.DISPATCHED, OrderStatus.POSTPONED, OrderStatus.CANCELLED]],
    [OrderStatus.COMPLETED, [OrderStatus.COLLECTED]],
    [OrderStatus.PARTIAL, [OrderStatus.COMPLETED, OrderStatus.COLLECTED]],
    [OrderStatus.COLLECTED, []], // Terminal state
    [OrderStatus.CANCELLED, []], // Terminal state
    [OrderStatus.REQUEST_CANCEL, []], // Terminal state
  ]);

  /**
   * Guard conditions for state transitions
   */
  private readonly guards: Map<
    string,
    (context: TransitionContext) => boolean
  > = new Map([
    // UNASSIGNED -> ASSIGNED: installer_id required
    [`${OrderStatus.UNASSIGNED}:${OrderStatus.ASSIGNED}`, (ctx) => !!ctx.installerId],
    
    // CONFIRMED -> RELEASED: appointment_date must be today
    [`${OrderStatus.CONFIRMED}:${OrderStatus.RELEASED}`, (ctx) => {
      const today = new Date().toISOString().split('T')[0];
      return ctx.appointmentDate === today;
    }],
    
    // DISPATCHED -> COMPLETED: serial_number required
    [`${OrderStatus.DISPATCHED}:${OrderStatus.COMPLETED}`, (ctx) => !!ctx.serialsCaptured],
    
    // DISPATCHED -> POSTPONED: reason_code required
    [`${OrderStatus.DISPATCHED}:${OrderStatus.POSTPONED}`, (ctx) => !!ctx.reasonCode],
    
    // DISPATCHED -> ABSENT: retry_count < 3
    [`${OrderStatus.DISPATCHED}:${OrderStatus.ABSENT}`, (ctx) => (ctx.retryCount || 0) < 3],
    
    // DISPATCHED -> CANCELLED: cancel_reason required
    [`${OrderStatus.DISPATCHED}:${OrderStatus.CANCELLED}`, (ctx) => !!ctx.reasonCode],
    
    // COMPLETED -> COLLECTED: waste_pickup logged
    [`${OrderStatus.COMPLETED}:${OrderStatus.COLLECTED}`, (ctx) => !!ctx.wastePickupLogged],
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
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
  details?: Record<string, unknown>;
}
