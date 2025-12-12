# Global Interceptors

This directory contains NestJS interceptors for the Logistics ERP API.

## Available Interceptors

### 1. LoggingInterceptor

Logs all incoming requests and responses with timing information.

**Features:**
- Logs request method, URL, user ID (from JWT), and correlation ID
- Calculates and logs response time in milliseconds
- Sanitizes sensitive data (passwords, tokens) in request body
- Uses structured logging compatible with pino

**What gets logged:**
```json
{
  "msg": "Incoming request",
  "method": "POST",
  "url": "/api/v1/orders",
  "userId": "user-123",
  "correlationId": "abc-def-123",
  "body": { "status": "ASSIGNED", "password": "***REDACTED***" }
}
```

### 2. TransformInterceptor

Wraps all successful responses in a standard format.

**Response format:**
```typescript
{
  "success": true,
  "data": { /* your response data */ },
  "timestamp": "2025-12-12T15:25:00.000Z"
}
```

**Exceptions:**
- Health check endpoints (`/api/health`, `/health`) are not transformed

### 3. TimeoutInterceptor

Adds a timeout to all API requests.

**Features:**
- Default timeout: 30 seconds
- Throws `RequestTimeoutException` on timeout
- Can be customized per-route using metadata

**Custom timeout example:**
```typescript
@SetMetadata('timeout', 60000) // 60 seconds
@Get('long-running-task')
async longTask() {
  // ...
}
```

## Usage

### Global Registration (Recommended)

Add to `main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  LoggingInterceptor,
  TransformInterceptor,
  TimeoutInterceptor,
} from './common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Register global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TimeoutInterceptor(),
    new TransformInterceptor(), // Should be last to wrap final response
  );

  await app.listen(3000);
}
bootstrap();
```

### Per-Module Registration

Add to module providers:

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
```

### Per-Route Registration

Use `@UseInterceptors()` decorator:

```typescript
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from './common/interceptors';

@Controller('orders')
export class OrdersController {
  @Get()
  @UseInterceptors(LoggingInterceptor)
  findAll() {
    // ...
  }
}
```

## Order of Execution

When multiple interceptors are registered, they execute in this order:

1. **Request Phase** (top to bottom):
   - TimeoutInterceptor (starts timeout timer)
   - LoggingInterceptor (logs incoming request)
   - TransformInterceptor (waits for response)

2. **Response Phase** (bottom to top):
   - TransformInterceptor (wraps response)
   - LoggingInterceptor (logs completion with duration)
   - TimeoutInterceptor (verifies within timeout)

## Logging Structured Data

The LoggingInterceptor is designed to work with pino's structured logging:

```typescript
// Logs will automatically include:
{
  msg: "Incoming request",
  method: "POST",
  url: "/api/v1/orders",
  userId: "user-123",
  correlationId: "1670856300000-abc123",
  body: { ... }, // sanitized
  duration: "125ms",
  statusCode: 200
}
```

## Correlation ID

The LoggingInterceptor automatically handles correlation IDs for request tracing:

- Reads from `X-Correlation-Id` header if provided
- Generates a unique ID if not provided
- Includes in all log entries for that request

**Client usage:**
```http
GET /api/v1/orders
X-Correlation-Id: my-custom-trace-id
```

## Sanitized Fields

The following fields are automatically redacted in logs:

- `password`
- `currentPassword`
- `newPassword`
- `confirmPassword`
- `token`
- `refreshToken`
- `secret`
- `apiKey`

## Integration with Existing Error Handling

These interceptors work seamlessly with:

- NestJS exception filters
- Validation pipes
- Guards (Auth, Roles, Throttler)

Errors thrown by guards or pipes are caught and logged by LoggingInterceptor.

## Performance Considerations

- **LoggingInterceptor**: Minimal overhead (~1-2ms per request)
- **TransformInterceptor**: Negligible overhead (simple object wrap)
- **TimeoutInterceptor**: No overhead unless timeout occurs

## Testing

Example test for interceptor behavior:

```typescript
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('should sanitize passwords in request body', () => {
    const body = { username: 'test', password: 'secret123' };
    const sanitized = interceptor['sanitizeRequestBody'](body);

    expect(sanitized.password).toBe('***REDACTED***');
    expect(sanitized.username).toBe('test');
  });
});
```

## Troubleshooting

### Issue: Logs not appearing

**Solution:** Ensure NestJS Logger is properly configured. Check `main.ts`:

```typescript
const app = await NestFactory.create(AppModule, {
  bufferLogs: true,
});
```

### Issue: Health check returning wrapped response

**Solution:** TransformInterceptor should skip health endpoints. Verify endpoint path matches:
- `/api/health`
- `/health`
- `/api/v1/health`

### Issue: Timeout too short for certain endpoints

**Solution:** Use `@SetMetadata('timeout', milliseconds)` decorator on specific routes:

```typescript
@SetMetadata('timeout', 120000) // 2 minutes
@Post('bulk-import')
async bulkImport() {
  // Long-running operation
}
```
