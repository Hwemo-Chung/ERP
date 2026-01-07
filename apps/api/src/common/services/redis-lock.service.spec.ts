import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { RedisLockService } from './redis-lock.service';
import { REDIS_PROVIDER } from '../constants';

describe('RedisLockService', () => {
  let service: RedisLockService;
  let mockRedis: jest.Mocked<{
    set: jest.Mock;
    eval: jest.Mock;
    quit: jest.Mock;
  }>;

  beforeEach(async () => {
    mockRedis = {
      set: jest.fn(),
      eval: jest.fn(),
      quit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisLockService,
        {
          provide: REDIS_PROVIDER,
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<RedisLockService>(RedisLockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully when key is not locked', async () => {
      mockRedis.set.mockResolvedValue('OK');

      const token = await service.acquireLock('order:123');

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:order:123',
        expect.any(String),
        'PX',
        3000,
        'NX',
      );
    });

    it('should return null when lock acquisition fails (already locked)', async () => {
      mockRedis.set.mockResolvedValue(null);

      const token = await service.acquireLock('order:456');

      expect(token).toBeNull();
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should use custom TTL when provided', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.acquireLock('order:789', 5000);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:order:789',
        expect.any(String),
        'PX',
        5000,
        'NX',
      );
    });

    it('should use default TTL of 3000ms when not provided', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await service.acquireLock('order:default');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:order:default',
        expect.any(String),
        'PX',
        3000,
        'NX',
      );
    });
  });

  describe('releaseLock', () => {
    it('should release lock successfully with correct token', async () => {
      mockRedis.eval.mockResolvedValue(1);

      const result = await service.releaseLock('order:123', 'valid-token');

      expect(result).toBe(true);
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call'),
        1,
        'lock:order:123',
        'valid-token',
      );
    });

    it('should return false when token does not match', async () => {
      mockRedis.eval.mockResolvedValue(0);

      const result = await service.releaseLock('order:123', 'wrong-token');

      expect(result).toBe(false);
    });

    it('should return false when lock does not exist', async () => {
      mockRedis.eval.mockResolvedValue(0);

      const result = await service.releaseLock('non-existent-key', 'any-token');

      expect(result).toBe(false);
    });

    it('should use Lua script for atomic check-and-delete', async () => {
      mockRedis.eval.mockResolvedValue(1);

      await service.releaseLock('order:atomic', 'token');

      const luaScript = mockRedis.eval.mock.calls[0][0];
      expect(luaScript).toContain('if redis.call("get", KEYS[1]) == ARGV[1]');
      expect(luaScript).toContain('return redis.call("del", KEYS[1])');
    });
  });

  describe('withLock', () => {
    it('should execute callback when lock is acquired', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue('result');

      const result = await service.withLock('order:callback', callback);

      expect(result).toBe('result');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when lock cannot be acquired', async () => {
      mockRedis.set.mockResolvedValue(null);

      const callback = jest.fn();

      await expect(service.withLock('order:locked', callback)).rejects.toThrow(
        ConflictException,
      );
      expect(callback).not.toHaveBeenCalled();
    });

    it('should release lock after successful callback execution', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue('success');

      await service.withLock('order:release', callback);

      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it('should release lock even when callback throws error', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const error = new Error('Callback failed');
      const callback = jest.fn().mockRejectedValue(error);

      await expect(service.withLock('order:error', callback)).rejects.toThrow(
        'Callback failed',
      );
      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it('should use custom TTL in withLock', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue('result');

      await service.withLock('order:ttl', callback, 10000);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:order:ttl',
        expect.any(String),
        'PX',
        10000,
        'NX',
      );
    });

    it('should return the callback result with correct type', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      const callback = jest.fn().mockResolvedValue({ id: '123', name: 'test' });

      const result = await service.withLock<{ id: string; name: string }>(
        'order:typed',
        callback,
      );

      expect(result).toEqual({ id: '123', name: 'test' });
    });
  });

  describe('onModuleDestroy', () => {
    it('should not throw error when called', () => {
      expect(() => service.onModuleDestroy()).not.toThrow();
    });
  });

  describe('lock prefix', () => {
    it('should prepend lock prefix to all keys', async () => {
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.eval.mockResolvedValue(1);

      await service.acquireLock('my-resource');
      await service.releaseLock('my-resource', 'token');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:my-resource',
        expect.any(String),
        'PX',
        expect.any(Number),
        'NX',
      );
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.any(String),
        1,
        'lock:my-resource',
        'token',
      );
    });
  });

  describe('concurrent lock scenarios', () => {
    it('should handle concurrent lock attempts correctly', async () => {
      // First attempt succeeds
      mockRedis.set.mockResolvedValueOnce('OK');
      // Second attempt fails (already locked)
      mockRedis.set.mockResolvedValueOnce(null);

      const [token1, token2] = await Promise.all([
        service.acquireLock('shared-resource'),
        service.acquireLock('shared-resource'),
      ]);

      expect(token1).not.toBeNull();
      expect(token2).toBeNull();
    });
  });
});
