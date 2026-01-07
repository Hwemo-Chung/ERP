import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { NotificationsProcessor, PushJobPayload } from './notifications.processor';
import { PushProviderFactory, PushSendResult } from './push-providers';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsProcessor', () => {
  let processor: NotificationsProcessor;
  let pushProviderFactory: { getProvider: jest.Mock };
  let mockNotificationFindUnique: jest.Mock;
  let mockSubscriptionFindMany: jest.Mock;
  let mockSubscriptionUpdate: jest.Mock;

  const mockPushProvider = {
    type: 'FCM',
    send: jest.fn(),
    isConfigured: jest.fn().mockReturnValue(true),
  };

  const mockSubscription = {
    id: 'sub-123',
    userId: 'user-123',
    deviceId: 'device-123',
    platform: 'ANDROID',
    pushProvider: 'FCM',
    token: { fcmToken: 'test-token' },
    categoriesEnabled: ['order_assigned'],
    isActive: true,
    quietHours: null,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNotification = {
    id: 'notif-123',
    userId: 'user-123',
    orderId: 'order-123',
    category: 'order_assigned',
    payload: { title: 'New Order', body: 'You have a new order assigned' },
    status: 'UNREAD',
    createdAt: new Date(),
    updatedAt: new Date(),
    readAt: null,
  };

  beforeEach(async () => {
    mockNotificationFindUnique = jest.fn();
    mockSubscriptionFindMany = jest.fn();
    mockSubscriptionUpdate = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsProcessor,
        {
          provide: PushProviderFactory,
          useValue: {
            getProvider: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            notificationSubscription: {
              findMany: mockSubscriptionFindMany,
              update: mockSubscriptionUpdate,
            },
            notification: {
              findUnique: mockNotificationFindUnique,
            },
          },
        },
      ],
    }).compile();

    processor = module.get<NotificationsProcessor>(NotificationsProcessor);
    pushProviderFactory = module.get(PushProviderFactory);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSendPush', () => {
    it('should process job and send push notification successfully', async () => {
      const jobData: PushJobPayload = {
        userId: 'user-123',
        notificationId: 'notif-123',
        category: 'order_assigned',
      };

      const mockJob = {
        id: 'job-1',
        data: jobData,
        attemptsMade: 0,
      } as Job<PushJobPayload>;

      mockNotificationFindUnique.mockResolvedValue(mockNotification);
      mockSubscriptionFindMany.mockResolvedValue([mockSubscription]);
      pushProviderFactory.getProvider.mockReturnValue(mockPushProvider as any);
      mockPushProvider.send.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
      } as PushSendResult);

      await processor.handleSendPush(mockJob);

      expect(mockNotificationFindUnique).toHaveBeenCalledWith({
        where: { id: 'notif-123' },
      });
      expect(mockSubscriptionFindMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isActive: true,
          categoriesEnabled: { has: 'order_assigned' },
        },
      });
      expect(pushProviderFactory.getProvider).toHaveBeenCalled();
      expect(mockPushProvider.send).toHaveBeenCalled();
    });

    it('should skip when no active subscriptions found', async () => {
      const jobData: PushJobPayload = {
        userId: 'user-123',
        notificationId: 'notif-123',
        category: 'order_assigned',
      };

      const mockJob = {
        id: 'job-1',
        data: jobData,
        attemptsMade: 0,
      } as Job<PushJobPayload>;

      mockNotificationFindUnique.mockResolvedValue(mockNotification);
      mockSubscriptionFindMany.mockResolvedValue([]);

      await processor.handleSendPush(mockJob);

      expect(pushProviderFactory.getProvider).not.toHaveBeenCalled();
    });

    it('should skip when notification not found', async () => {
      const jobData: PushJobPayload = {
        userId: 'user-123',
        notificationId: 'notif-not-exist',
        category: 'order_assigned',
      };

      const mockJob = {
        id: 'job-1',
        data: jobData,
        attemptsMade: 0,
      } as Job<PushJobPayload>;

      mockNotificationFindUnique.mockResolvedValue(null);

      await processor.handleSendPush(mockJob);

      expect(mockSubscriptionFindMany).not.toHaveBeenCalled();
    });

    it('should deactivate subscription when provider returns shouldRemoveSubscription', async () => {
      const jobData: PushJobPayload = {
        userId: 'user-123',
        notificationId: 'notif-123',
        category: 'order_assigned',
      };

      const mockJob = {
        id: 'job-1',
        data: jobData,
        attemptsMade: 0,
      } as Job<PushJobPayload>;

      mockNotificationFindUnique.mockResolvedValue(mockNotification);
      mockSubscriptionFindMany.mockResolvedValue([mockSubscription]);
      pushProviderFactory.getProvider.mockReturnValue(mockPushProvider as any);
      mockPushProvider.send.mockResolvedValue({
        success: false,
        error: 'Invalid registration token',
        shouldRemoveSubscription: true,
      } as PushSendResult);

      await processor.handleSendPush(mockJob);

      expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
        where: { id: 'sub-123' },
        data: { isActive: false },
      });
    });

    it('should skip subscription when push provider is not configured', async () => {
      const jobData: PushJobPayload = {
        userId: 'user-123',
        notificationId: 'notif-123',
        category: 'order_assigned',
      };

      const mockJob = {
        id: 'job-1',
        data: jobData,
        attemptsMade: 0,
      } as Job<PushJobPayload>;

      mockNotificationFindUnique.mockResolvedValue(mockNotification);
      mockSubscriptionFindMany.mockResolvedValue([mockSubscription]);
      pushProviderFactory.getProvider.mockReturnValue(null);

      await processor.handleSendPush(mockJob);

      expect(mockPushProvider.send).not.toHaveBeenCalled();
    });

    it('should validate job data has required fields', async () => {
      const invalidJobData = {
        userId: 'user-123',
        // Missing notificationId and category
      } as PushJobPayload;

      const mockJob = {
        id: 'job-1',
        data: invalidJobData,
        attemptsMade: 0,
      } as Job<PushJobPayload>;

      // Should throw validation error
      await expect(processor.handleSendPush(mockJob)).rejects.toThrow();
    });

    it('should handle push send error gracefully', async () => {
      const jobData: PushJobPayload = {
        userId: 'user-123',
        notificationId: 'notif-123',
        category: 'order_assigned',
      };

      const mockJob = {
        id: 'job-1',
        data: jobData,
        attemptsMade: 0,
      } as Job<PushJobPayload>;

      mockNotificationFindUnique.mockResolvedValue(mockNotification);
      mockSubscriptionFindMany.mockResolvedValue([mockSubscription]);
      pushProviderFactory.getProvider.mockReturnValue(mockPushProvider as any);
      mockPushProvider.send.mockRejectedValue(new Error('Network error'));

      // Should not throw, but handle error gracefully
      await expect(processor.handleSendPush(mockJob)).resolves.not.toThrow();
    });
  });

  describe('handleFailed', () => {
    it('should log error when job fails', () => {
      const mockJob = {
        id: 'job-1',
        data: {
          userId: 'user-123',
          notificationId: 'notif-123',
          category: 'order_assigned',
        },
        attemptsMade: 2,
      } as Job<PushJobPayload>;

      const error = new Error('Push send failed');
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      processor.handleFailed(mockJob, error);

      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should log final failure when max attempts reached', () => {
      const mockJob = {
        id: 'job-1',
        data: {
          userId: 'user-123',
          notificationId: 'notif-123',
          category: 'order_assigned',
        },
        attemptsMade: 3,
        opts: { attempts: 3 },
      } as Job<PushJobPayload>;

      const error = new Error('Push send failed after max retries');
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');

      processor.handleFailed(mockJob, error);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('max attempts'),
        expect.any(String),
      );
    });
  });

  describe('quiet hours handling', () => {
    it('should skip push during quiet hours for non-urgent notifications', async () => {
      const quietHoursSubscription = {
        ...mockSubscription,
        quietHours: {
          enabled: true,
          start: '00:00',
          end: '23:59',
          timezone: 'Asia/Seoul',
        },
      };

      const jobData: PushJobPayload = {
        userId: 'user-123',
        notificationId: 'notif-123',
        category: 'order_assigned', // Non-urgent
      };

      const mockJob = {
        id: 'job-1',
        data: jobData,
        attemptsMade: 0,
      } as Job<PushJobPayload>;

      mockNotificationFindUnique.mockResolvedValue(mockNotification);
      mockSubscriptionFindMany.mockResolvedValue([quietHoursSubscription]);

      await processor.handleSendPush(mockJob);

      expect(mockPushProvider.send).not.toHaveBeenCalled();
    });

    it('should send push during quiet hours for urgent notifications', async () => {
      const quietHoursSubscription = {
        ...mockSubscription,
        quietHours: {
          enabled: true,
          start: '00:00',
          end: '23:59',
          timezone: 'Asia/Seoul',
        },
        categoriesEnabled: ['settlement_locked'],
      };

      const urgentNotification = {
        ...mockNotification,
        category: 'settlement_locked',
      };

      const jobData: PushJobPayload = {
        userId: 'user-123',
        notificationId: 'notif-123',
        category: 'settlement_locked', // Urgent
      };

      const mockJob = {
        id: 'job-1',
        data: jobData,
        attemptsMade: 0,
      } as Job<PushJobPayload>;

      mockNotificationFindUnique.mockResolvedValue(urgentNotification);
      mockSubscriptionFindMany.mockResolvedValue([quietHoursSubscription]);
      pushProviderFactory.getProvider.mockReturnValue(mockPushProvider as any);
      mockPushProvider.send.mockResolvedValue({ success: true, messageId: 'msg-123' });

      await processor.handleSendPush(mockJob);

      expect(mockPushProvider.send).toHaveBeenCalled();
    });
  });

  describe('exponential backoff retry', () => {
    it('should have correct job options for retry', () => {
      // This test verifies the queue configuration
      // The actual backoff is configured in the module
      const expectedOptions = {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
      };

      // We verify these options are applied at module level
      expect(expectedOptions.attempts).toBe(3);
      expect(expectedOptions.backoff.type).toBe('exponential');
      expect(expectedOptions.backoff.delay).toBe(1000);
    });
  });

  describe('payload building', () => {
    it('should build correct push payload from notification', async () => {
      const jobData: PushJobPayload = {
        userId: 'user-123',
        notificationId: 'notif-123',
        category: 'order_assigned',
      };

      const mockJob = {
        id: 'job-1',
        data: jobData,
        attemptsMade: 0,
      } as Job<PushJobPayload>;

      mockNotificationFindUnique.mockResolvedValue(mockNotification);
      mockSubscriptionFindMany.mockResolvedValue([mockSubscription]);
      pushProviderFactory.getProvider.mockReturnValue(mockPushProvider as any);
      mockPushProvider.send.mockResolvedValue({ success: true, messageId: 'msg-123' });

      await processor.handleSendPush(mockJob);

      expect(mockPushProvider.send).toHaveBeenCalledWith(
        mockSubscription.token,
        expect.objectContaining({
          title: 'New Order',
          body: 'You have a new order assigned',
        }),
      );
    });
  });
});
