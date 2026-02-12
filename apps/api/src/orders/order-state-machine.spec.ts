import { Test, TestingModule } from '@nestjs/testing';
import { OrderStateMachine, TransitionContext } from './order-state-machine';
import { OrderStatus } from '@prisma/client';

describe('OrderStateMachine', () => {
  let stateMachine: OrderStateMachine;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderStateMachine],
    }).compile();

    stateMachine = module.get<OrderStateMachine>(OrderStateMachine);
  });

  describe('canTransition', () => {
    describe('valid transitions', () => {
      it('should allow UNASSIGNED → ASSIGNED', () => {
        expect(stateMachine.canTransition(OrderStatus.UNASSIGNED, OrderStatus.ASSIGNED)).toBe(true);
      });

      it('should allow ASSIGNED → CONFIRMED', () => {
        expect(stateMachine.canTransition(OrderStatus.ASSIGNED, OrderStatus.CONFIRMED)).toBe(true);
      });

      it('should allow CONFIRMED → RELEASED', () => {
        expect(stateMachine.canTransition(OrderStatus.CONFIRMED, OrderStatus.RELEASED)).toBe(true);
      });

      it('should allow RELEASED → DISPATCHED', () => {
        expect(stateMachine.canTransition(OrderStatus.RELEASED, OrderStatus.DISPATCHED)).toBe(true);
      });

      it('should allow DISPATCHED → COMPLETED', () => {
        expect(stateMachine.canTransition(OrderStatus.DISPATCHED, OrderStatus.COMPLETED)).toBe(
          true,
        );
      });

      it('should allow DISPATCHED → PARTIAL', () => {
        expect(stateMachine.canTransition(OrderStatus.DISPATCHED, OrderStatus.PARTIAL)).toBe(true);
      });

      it('should allow DISPATCHED → POSTPONED', () => {
        expect(stateMachine.canTransition(OrderStatus.DISPATCHED, OrderStatus.POSTPONED)).toBe(
          true,
        );
      });

      it('should allow DISPATCHED → ABSENT', () => {
        expect(stateMachine.canTransition(OrderStatus.DISPATCHED, OrderStatus.ABSENT)).toBe(true);
      });

      it('should allow DISPATCHED → CANCELLED', () => {
        expect(stateMachine.canTransition(OrderStatus.DISPATCHED, OrderStatus.CANCELLED)).toBe(
          true,
        );
      });

      it('should allow COMPLETED → COLLECTED', () => {
        expect(stateMachine.canTransition(OrderStatus.COMPLETED, OrderStatus.COLLECTED)).toBe(true);
      });

      it('should allow PARTIAL → COMPLETED', () => {
        expect(stateMachine.canTransition(OrderStatus.PARTIAL, OrderStatus.COMPLETED)).toBe(true);
      });

      it('should allow PARTIAL → COLLECTED', () => {
        expect(stateMachine.canTransition(OrderStatus.PARTIAL, OrderStatus.COLLECTED)).toBe(true);
      });
    });

    describe('revert transitions', () => {
      it('should allow ASSIGNED → UNASSIGNED (revert)', () => {
        expect(stateMachine.canTransition(OrderStatus.ASSIGNED, OrderStatus.UNASSIGNED)).toBe(true);
      });

      it('should allow CONFIRMED → ASSIGNED (revert)', () => {
        expect(stateMachine.canTransition(OrderStatus.CONFIRMED, OrderStatus.ASSIGNED)).toBe(true);
      });

      it('should allow RELEASED → CONFIRMED (revert)', () => {
        expect(stateMachine.canTransition(OrderStatus.RELEASED, OrderStatus.CONFIRMED)).toBe(true);
      });

      it('should allow POSTPONED → DISPATCHED (retry)', () => {
        expect(stateMachine.canTransition(OrderStatus.POSTPONED, OrderStatus.DISPATCHED)).toBe(
          true,
        );
      });

      it('should allow ABSENT → DISPATCHED (retry)', () => {
        expect(stateMachine.canTransition(OrderStatus.ABSENT, OrderStatus.DISPATCHED)).toBe(true);
      });

      it('should allow POSTPONED → ABSENT', () => {
        expect(stateMachine.canTransition(OrderStatus.POSTPONED, OrderStatus.ABSENT)).toBe(true);
      });

      it('should allow ABSENT → POSTPONED', () => {
        expect(stateMachine.canTransition(OrderStatus.ABSENT, OrderStatus.POSTPONED)).toBe(true);
      });
    });

    describe('invalid transitions', () => {
      it('should reject UNASSIGNED → COMPLETED (direct jump)', () => {
        expect(stateMachine.canTransition(OrderStatus.UNASSIGNED, OrderStatus.COMPLETED)).toBe(
          false,
        );
      });

      it('should reject COMPLETED → ASSIGNED (reverse)', () => {
        expect(stateMachine.canTransition(OrderStatus.COMPLETED, OrderStatus.ASSIGNED)).toBe(false);
      });

      it('should reject COLLECTED → ASSIGNED (terminal state)', () => {
        expect(stateMachine.canTransition(OrderStatus.COLLECTED, OrderStatus.ASSIGNED)).toBe(false);
      });

      it('should reject CANCELLED → DISPATCHED (terminal state)', () => {
        expect(stateMachine.canTransition(OrderStatus.CANCELLED, OrderStatus.DISPATCHED)).toBe(
          false,
        );
      });

      it('should reject UNASSIGNED → DISPATCHED (skipping states)', () => {
        expect(stateMachine.canTransition(OrderStatus.UNASSIGNED, OrderStatus.DISPATCHED)).toBe(
          false,
        );
      });

      it('should reject ASSIGNED → RELEASED (skipping CONFIRMED)', () => {
        expect(stateMachine.canTransition(OrderStatus.ASSIGNED, OrderStatus.RELEASED)).toBe(false);
      });

      it('should reject CONFIRMED → DISPATCHED (skipping RELEASED)', () => {
        expect(stateMachine.canTransition(OrderStatus.CONFIRMED, OrderStatus.DISPATCHED)).toBe(
          false,
        );
      });
    });
  });

  describe('validateTransition', () => {
    describe('UNASSIGNED → ASSIGNED guard', () => {
      const from = OrderStatus.UNASSIGNED;
      const to = OrderStatus.ASSIGNED;

      it('should pass with valid installerId', () => {
        const context: TransitionContext = {
          installerId: 'installer-123',
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should fail without installerId', () => {
        const context: TransitionContext = {};

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
        expect(result.errorCode).toBe('E2001');
        expect(result.details).toEqual({
          from,
          to,
          guardKey: `${from}:${to}`,
        });
      });

      it('should fail with undefined installerId', () => {
        const context: TransitionContext = {
          installerId: undefined,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
      });

      it('should fail with empty string installerId', () => {
        const context: TransitionContext = {
          installerId: '',
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
      });
    });

    describe('CONFIRMED → RELEASED guard', () => {
      const from = OrderStatus.CONFIRMED;
      const to = OrderStatus.RELEASED;

      it('should pass when appointment date is today', () => {
        const today = new Date().toISOString().split('T')[0];
        const context: TransitionContext = {
          appointmentDate: today,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(true);
      });

      it('should fail when appointment date is tomorrow', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        const context: TransitionContext = {
          appointmentDate: tomorrowStr,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
        expect(result.errorCode).toBe('E2001');
      });

      it('should fail when appointment date is yesterday', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const context: TransitionContext = {
          appointmentDate: yesterdayStr,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
      });

      it('should fail without appointment date', () => {
        const context: TransitionContext = {};

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
      });
    });

    describe('DISPATCHED → COMPLETED guard', () => {
      const from = OrderStatus.DISPATCHED;
      const to = OrderStatus.COMPLETED;

      it('should pass with serialsCaptured = true', () => {
        const context: TransitionContext = {
          serialsCaptured: true,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(true);
      });

      it('should fail with serialsCaptured = false', () => {
        const context: TransitionContext = {
          serialsCaptured: false,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
        expect(result.errorCode).toBe('E2001');
      });

      it('should fail without serialsCaptured', () => {
        const context: TransitionContext = {};

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
      });
    });

    describe('DISPATCHED → POSTPONED guard', () => {
      const from = OrderStatus.DISPATCHED;
      const to = OrderStatus.POSTPONED;

      it('should pass with valid reasonCode', () => {
        const context: TransitionContext = {
          reasonCode: 'CUSTOMER_UNAVAILABLE',
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(true);
      });

      it('should fail without reasonCode', () => {
        const context: TransitionContext = {};

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
        expect(result.errorCode).toBe('E2001');
      });

      it('should fail with empty reasonCode', () => {
        const context: TransitionContext = {
          reasonCode: '',
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
      });
    });

    describe('DISPATCHED → ABSENT guard', () => {
      const from = OrderStatus.DISPATCHED;
      const to = OrderStatus.ABSENT;

      it('should pass with retryCount = 0', () => {
        const context: TransitionContext = {
          retryCount: 0,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(true);
      });

      it('should pass with retryCount = 2 (last retry)', () => {
        const context: TransitionContext = {
          retryCount: 2,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(true);
      });

      it('should pass without retryCount (defaults to 0)', () => {
        const context: TransitionContext = {};

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(true);
      });

      it('should fail with retryCount = 3 (max retries exceeded)', () => {
        const context: TransitionContext = {
          retryCount: 3,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
        expect(result.errorCode).toBe('E2001');
      });

      it('should fail with retryCount = 5', () => {
        const context: TransitionContext = {
          retryCount: 5,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
      });
    });

    describe('DISPATCHED → CANCELLED guard', () => {
      const from = OrderStatus.DISPATCHED;
      const to = OrderStatus.CANCELLED;

      it('should pass with valid reasonCode', () => {
        const context: TransitionContext = {
          reasonCode: 'CUSTOMER_REQUEST',
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(true);
      });

      it('should fail without reasonCode', () => {
        const context: TransitionContext = {};

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
        expect(result.errorCode).toBe('E2001');
      });
    });

    describe('COMPLETED → COLLECTED guard', () => {
      const from = OrderStatus.COMPLETED;
      const to = OrderStatus.COLLECTED;

      it('should pass with wastePickupLogged = true', () => {
        const context: TransitionContext = {
          wastePickupLogged: true,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(true);
      });

      it('should fail with wastePickupLogged = false', () => {
        const context: TransitionContext = {
          wastePickupLogged: false,
        };

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
        expect(result.errorCode).toBe('E2001');
      });

      it('should fail without wastePickupLogged', () => {
        const context: TransitionContext = {};

        const result = stateMachine.validateTransition(from, to, context);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.transition_guard_failed');
      });
    });

    describe('invalid state transitions', () => {
      it('should reject UNASSIGNED → COMPLETED', () => {
        const context: TransitionContext = {
          serialsCaptured: true,
        };

        const result = stateMachine.validateTransition(
          OrderStatus.UNASSIGNED,
          OrderStatus.COMPLETED,
          context,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.invalid_status_transition');
        expect(result.errorCode).toBe('E2001');
        expect(result.details).toEqual({
          from: OrderStatus.UNASSIGNED,
          to: OrderStatus.COMPLETED,
        });
      });

      it('should reject COLLECTED → ASSIGNED', () => {
        const context: TransitionContext = {
          installerId: 'installer-123',
        };

        const result = stateMachine.validateTransition(
          OrderStatus.COLLECTED,
          OrderStatus.ASSIGNED,
          context,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.invalid_status_transition');
        expect(result.errorCode).toBe('E2001');
      });
    });

    describe('transitions without guards', () => {
      it('should pass ASSIGNED → CONFIRMED without context', () => {
        const result = stateMachine.validateTransition(
          OrderStatus.ASSIGNED,
          OrderStatus.CONFIRMED,
          {},
        );

        expect(result.valid).toBe(true);
      });

      it('should pass ASSIGNED → UNASSIGNED (revert) without context', () => {
        const result = stateMachine.validateTransition(
          OrderStatus.ASSIGNED,
          OrderStatus.UNASSIGNED,
          {},
        );

        expect(result.valid).toBe(true);
      });
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return [ASSIGNED] for UNASSIGNED', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.UNASSIGNED);
      expect(transitions).toEqual([OrderStatus.ASSIGNED]);
    });

    it('should return [CONFIRMED, UNASSIGNED, REQUEST_CANCEL] for ASSIGNED', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.ASSIGNED);
      expect(transitions).toEqual([
        OrderStatus.CONFIRMED,
        OrderStatus.UNASSIGNED,
        OrderStatus.REQUEST_CANCEL,
      ]);
    });

    it('should return [RELEASED, ASSIGNED, REQUEST_CANCEL] for CONFIRMED', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.CONFIRMED);
      expect(transitions).toEqual([
        OrderStatus.RELEASED,
        OrderStatus.ASSIGNED,
        OrderStatus.REQUEST_CANCEL,
      ]);
    });

    it('should return [DISPATCHED, CONFIRMED, REQUEST_CANCEL] for RELEASED', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.RELEASED);
      expect(transitions).toEqual([
        OrderStatus.DISPATCHED,
        OrderStatus.CONFIRMED,
        OrderStatus.REQUEST_CANCEL,
      ]);
    });

    it('should return 6 options for DISPATCHED', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.DISPATCHED);
      expect(transitions).toEqual([
        OrderStatus.COMPLETED,
        OrderStatus.PARTIAL,
        OrderStatus.POSTPONED,
        OrderStatus.ABSENT,
        OrderStatus.CANCELLED,
        OrderStatus.REQUEST_CANCEL,
      ]);
    });

    it('should return [DISPATCHED, ABSENT, CANCELLED, REQUEST_CANCEL] for POSTPONED', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.POSTPONED);
      expect(transitions).toEqual([
        OrderStatus.DISPATCHED,
        OrderStatus.ABSENT,
        OrderStatus.CANCELLED,
        OrderStatus.REQUEST_CANCEL,
      ]);
    });

    it('should return [DISPATCHED, POSTPONED, CANCELLED, REQUEST_CANCEL] for ABSENT', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.ABSENT);
      expect(transitions).toEqual([
        OrderStatus.DISPATCHED,
        OrderStatus.POSTPONED,
        OrderStatus.CANCELLED,
        OrderStatus.REQUEST_CANCEL,
      ]);
    });

    it('should return [COLLECTED] for COMPLETED', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.COMPLETED);
      expect(transitions).toEqual([OrderStatus.COLLECTED]);
    });

    it('should return [COMPLETED, COLLECTED] for PARTIAL', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.PARTIAL);
      expect(transitions).toEqual([OrderStatus.COMPLETED, OrderStatus.COLLECTED]);
    });

    it('should return empty array for COLLECTED (terminal)', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.COLLECTED);
      expect(transitions).toEqual([]);
    });

    it('should return empty array for CANCELLED (terminal)', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.CANCELLED);
      expect(transitions).toEqual([]);
    });

    it('should return [CANCELLED, DISPATCHED] for REQUEST_CANCEL (non-terminal)', () => {
      const transitions = stateMachine.getAvailableTransitions(OrderStatus.REQUEST_CANCEL);
      expect(transitions).toEqual([OrderStatus.CANCELLED, OrderStatus.DISPATCHED]);
    });
  });

  describe('isTerminalState', () => {
    it('should return false for UNASSIGNED', () => {
      expect(stateMachine.isTerminalState(OrderStatus.UNASSIGNED)).toBe(false);
    });

    it('should return false for ASSIGNED', () => {
      expect(stateMachine.isTerminalState(OrderStatus.ASSIGNED)).toBe(false);
    });

    it('should return false for CONFIRMED', () => {
      expect(stateMachine.isTerminalState(OrderStatus.CONFIRMED)).toBe(false);
    });

    it('should return false for RELEASED', () => {
      expect(stateMachine.isTerminalState(OrderStatus.RELEASED)).toBe(false);
    });

    it('should return false for DISPATCHED', () => {
      expect(stateMachine.isTerminalState(OrderStatus.DISPATCHED)).toBe(false);
    });

    it('should return false for COMPLETED (can go to COLLECTED)', () => {
      expect(stateMachine.isTerminalState(OrderStatus.COMPLETED)).toBe(false);
    });

    it('should return false for PARTIAL (can go to COMPLETED/COLLECTED)', () => {
      expect(stateMachine.isTerminalState(OrderStatus.PARTIAL)).toBe(false);
    });

    it('should return false for POSTPONED (can retry)', () => {
      expect(stateMachine.isTerminalState(OrderStatus.POSTPONED)).toBe(false);
    });

    it('should return false for ABSENT (can retry)', () => {
      expect(stateMachine.isTerminalState(OrderStatus.ABSENT)).toBe(false);
    });

    it('should return true for COLLECTED (terminal)', () => {
      expect(stateMachine.isTerminalState(OrderStatus.COLLECTED)).toBe(true);
    });

    it('should return true for CANCELLED (terminal)', () => {
      expect(stateMachine.isTerminalState(OrderStatus.CANCELLED)).toBe(true);
    });

    it('should return false for REQUEST_CANCEL (can go to CANCELLED)', () => {
      expect(stateMachine.isTerminalState(OrderStatus.REQUEST_CANCEL)).toBe(false);
    });
  });

  describe('canRevert', () => {
    describe('within revert window (5 days)', () => {
      it('should allow revert on the same day (day 0)', () => {
        const completedAt = new Date();
        const originalPromisedDate = new Date();

        const result = stateMachine.canRevert(completedAt, originalPromisedDate);

        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should allow revert after 1 day', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 1);
        const originalPromisedDate = new Date();

        const result = stateMachine.canRevert(completedAt, originalPromisedDate);

        expect(result.valid).toBe(true);
      });

      it('should allow revert after 3 days', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 3);
        const originalPromisedDate = new Date();

        const result = stateMachine.canRevert(completedAt, originalPromisedDate);

        expect(result.valid).toBe(true);
      });

      it('should allow revert on the 5th day (boundary)', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 5);
        const originalPromisedDate = new Date();

        const result = stateMachine.canRevert(completedAt, originalPromisedDate);

        expect(result.valid).toBe(true);
      });
    });

    describe('beyond revert window', () => {
      it('should reject revert after 6 days', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 6);
        const originalPromisedDate = new Date();

        const result = stateMachine.canRevert(completedAt, originalPromisedDate);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.revert_window_exceeded');
        expect(result.errorCode).toBe('E2003');
        expect(result.details).toEqual({
          daysSinceCompletion: 6,
          maxDays: 5,
        });
      });

      it('should reject revert after 10 days', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 10);
        const originalPromisedDate = new Date();

        const result = stateMachine.canRevert(completedAt, originalPromisedDate);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.revert_window_exceeded');
        expect(result.errorCode).toBe('E2003');
        expect(result.details?.daysSinceCompletion).toBe(10);
      });

      it('should reject revert after 30 days', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 30);
        const originalPromisedDate = new Date();

        const result = stateMachine.canRevert(completedAt, originalPromisedDate);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.revert_window_exceeded');
      });
    });

    describe('appointment date change window (15 days)', () => {
      it('should allow appointment change within 15 days', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 2); // Revert window: OK

        const originalPromisedDate = new Date();
        const newAppointmentDate = new Date();
        newAppointmentDate.setDate(originalPromisedDate.getDate() + 10); // +10 days: OK

        const result = stateMachine.canRevert(
          completedAt,
          originalPromisedDate,
          newAppointmentDate,
        );

        expect(result.valid).toBe(true);
      });

      it('should allow appointment change on 15th day (boundary)', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 2);

        const originalPromisedDate = new Date();
        const newAppointmentDate = new Date();
        newAppointmentDate.setDate(originalPromisedDate.getDate() + 15);

        const result = stateMachine.canRevert(
          completedAt,
          originalPromisedDate,
          newAppointmentDate,
        );

        expect(result.valid).toBe(true);
      });

      it('should reject appointment change after 16 days', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 2); // Revert window: OK

        const originalPromisedDate = new Date();
        const newAppointmentDate = new Date();
        newAppointmentDate.setDate(originalPromisedDate.getDate() + 16); // +16 days: NG

        const result = stateMachine.canRevert(
          completedAt,
          originalPromisedDate,
          newAppointmentDate,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.appointment_date_exceeded');
        expect(result.errorCode).toBe('E2003');
        expect(result.details).toEqual({
          daysSincePromised: 16,
          maxDays: 15,
        });
      });

      it('should reject appointment change after 30 days', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 2);

        const originalPromisedDate = new Date();
        const newAppointmentDate = new Date();
        newAppointmentDate.setDate(originalPromisedDate.getDate() + 30);

        const result = stateMachine.canRevert(
          completedAt,
          originalPromisedDate,
          newAppointmentDate,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.appointment_date_exceeded');
      });
    });

    describe('combined revert and appointment change rules', () => {
      it('should reject when revert window exceeded, even with valid appointment change', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 6); // Revert window: NG

        const originalPromisedDate = new Date();
        const newAppointmentDate = new Date();
        newAppointmentDate.setDate(originalPromisedDate.getDate() + 5); // Appointment: OK

        const result = stateMachine.canRevert(
          completedAt,
          originalPromisedDate,
          newAppointmentDate,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.revert_window_exceeded');
      });

      it('should reject when appointment change exceeded, even within revert window', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 2); // Revert window: OK

        const originalPromisedDate = new Date();
        const newAppointmentDate = new Date();
        newAppointmentDate.setDate(originalPromisedDate.getDate() + 20); // Appointment: NG

        const result = stateMachine.canRevert(
          completedAt,
          originalPromisedDate,
          newAppointmentDate,
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.appointment_date_exceeded');
      });

      it('should allow when both windows are valid', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 3); // Revert window: OK

        const originalPromisedDate = new Date();
        const newAppointmentDate = new Date();
        newAppointmentDate.setDate(originalPromisedDate.getDate() + 7); // Appointment: OK

        const result = stateMachine.canRevert(
          completedAt,
          originalPromisedDate,
          newAppointmentDate,
        );

        expect(result.valid).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('should handle exact time boundaries correctly', () => {
        // 5 days + 23 hours 59 minutes should still be within window
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 5);
        completedAt.setHours(completedAt.getHours() - 23);
        completedAt.setMinutes(completedAt.getMinutes() - 59);

        const originalPromisedDate = new Date();

        const result = stateMachine.canRevert(completedAt, originalPromisedDate);

        expect(result.valid).toBe(true);
      });

      it('should handle past appointment dates', () => {
        const completedAt = new Date();
        completedAt.setDate(completedAt.getDate() - 2);

        const originalPromisedDate = new Date();
        originalPromisedDate.setDate(originalPromisedDate.getDate() - 10);

        // Create newAppointmentDate as copy of originalPromisedDate + 5 days
        // This ensures it's within the 15-day window from originalPromisedDate
        const newAppointmentDate = new Date(originalPromisedDate.getTime());
        newAppointmentDate.setDate(newAppointmentDate.getDate() + 5);

        const result = stateMachine.canRevert(
          completedAt,
          originalPromisedDate,
          newAppointmentDate,
        );

        expect(result.valid).toBe(true);
      });
    });
  });

  describe('integration scenarios', () => {
    describe('complete order lifecycle', () => {
      it('should validate full happy path', () => {
        const today = new Date().toISOString().split('T')[0];

        // UNASSIGNED → ASSIGNED
        let result = stateMachine.validateTransition(OrderStatus.UNASSIGNED, OrderStatus.ASSIGNED, {
          installerId: 'installer-123',
        });
        expect(result.valid).toBe(true);

        // ASSIGNED → CONFIRMED
        result = stateMachine.validateTransition(OrderStatus.ASSIGNED, OrderStatus.CONFIRMED, {});
        expect(result.valid).toBe(true);

        // CONFIRMED → RELEASED
        result = stateMachine.validateTransition(OrderStatus.CONFIRMED, OrderStatus.RELEASED, {
          appointmentDate: today,
        });
        expect(result.valid).toBe(true);

        // RELEASED → DISPATCHED
        result = stateMachine.validateTransition(OrderStatus.RELEASED, OrderStatus.DISPATCHED, {});
        expect(result.valid).toBe(true);

        // DISPATCHED → COMPLETED
        result = stateMachine.validateTransition(OrderStatus.DISPATCHED, OrderStatus.COMPLETED, {
          serialsCaptured: true,
        });
        expect(result.valid).toBe(true);

        // COMPLETED → COLLECTED
        result = stateMachine.validateTransition(OrderStatus.COMPLETED, OrderStatus.COLLECTED, {
          wastePickupLogged: true,
        });
        expect(result.valid).toBe(true);
      });

      it('should validate partial completion path', () => {
        const today = new Date().toISOString().split('T')[0];

        // Path to DISPATCHED
        let result = stateMachine.validateTransition(OrderStatus.UNASSIGNED, OrderStatus.ASSIGNED, {
          installerId: 'installer-123',
        });
        expect(result.valid).toBe(true);

        // DISPATCHED → PARTIAL (no guard)
        result = stateMachine.validateTransition(OrderStatus.DISPATCHED, OrderStatus.PARTIAL, {});
        expect(result.valid).toBe(true);

        // PARTIAL → COMPLETED (guard requires partialItemsResolved)
        result = stateMachine.validateTransition(OrderStatus.PARTIAL, OrderStatus.COMPLETED, {
          partialItemsResolved: true,
        });
        expect(result.valid).toBe(true);
      });

      it('should validate postponed and retry path', () => {
        // DISPATCHED → POSTPONED
        let result = stateMachine.validateTransition(
          OrderStatus.DISPATCHED,
          OrderStatus.POSTPONED,
          { reasonCode: 'CUSTOMER_UNAVAILABLE' },
        );
        expect(result.valid).toBe(true);

        // POSTPONED → DISPATCHED (retry)
        result = stateMachine.validateTransition(OrderStatus.POSTPONED, OrderStatus.DISPATCHED, {});
        expect(result.valid).toBe(true);
      });

      it('should validate absent retry path with limit', () => {
        // First attempt: DISPATCHED → ABSENT
        let result = stateMachine.validateTransition(OrderStatus.DISPATCHED, OrderStatus.ABSENT, {
          retryCount: 0,
        });
        expect(result.valid).toBe(true);

        // Second attempt: ABSENT → DISPATCHED → ABSENT
        result = stateMachine.validateTransition(OrderStatus.ABSENT, OrderStatus.DISPATCHED, {});
        expect(result.valid).toBe(true);

        result = stateMachine.validateTransition(OrderStatus.DISPATCHED, OrderStatus.ABSENT, {
          retryCount: 1,
        });
        expect(result.valid).toBe(true);

        // Third attempt (last): ABSENT → DISPATCHED → ABSENT
        result = stateMachine.validateTransition(OrderStatus.ABSENT, OrderStatus.DISPATCHED, {});
        expect(result.valid).toBe(true);

        result = stateMachine.validateTransition(OrderStatus.DISPATCHED, OrderStatus.ABSENT, {
          retryCount: 2,
        });
        expect(result.valid).toBe(true);

        // Fourth attempt: should fail
        result = stateMachine.validateTransition(OrderStatus.DISPATCHED, OrderStatus.ABSENT, {
          retryCount: 3,
        });
        expect(result.valid).toBe(false);
      });
    });

    describe('error scenarios', () => {
      it('should prevent skipping required states', () => {
        const result = stateMachine.validateTransition(
          OrderStatus.UNASSIGNED,
          OrderStatus.DISPATCHED,
          { installerId: 'installer-123' },
        );

        expect(result.valid).toBe(false);
        expect(result.error).toBe('error.invalid_status_transition');
      });

      it('should prevent transitions from terminal states', () => {
        let result = stateMachine.validateTransition(
          OrderStatus.COLLECTED,
          OrderStatus.DISPATCHED,
          {},
        );
        expect(result.valid).toBe(false);

        result = stateMachine.validateTransition(OrderStatus.CANCELLED, OrderStatus.ASSIGNED, {
          installerId: 'installer-123',
        });
        expect(result.valid).toBe(false);
      });
    });
  });
});
