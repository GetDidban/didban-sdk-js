# @didban/nestjs

یکپارچه‌سازی بومی NestJS برای ثبت خطا، trace و تشخیص کندی با استفاده از Node SDK دیدبان.

```bash
npm install @didban/nestjs
```

## راه‌اندازی

```ts
import { Module } from '@nestjs/common';
import { DidbanModule } from '@didban/nestjs';

@Module({
  imports: [
    DidbanModule.forRoot({
      apiKey: process.env.DIDBAN_API_KEY!,
      appName: 'payment-api',
      config: {
        environment: process.env.NODE_ENV,
        release: process.env.APP_VERSION,
        slowOperationThresholdMs: 1_000,
      },
    }),
  ],
})
export class AppModule {}
```

ماژول به‌صورت پیش‌فرض global است و موارد زیر را خودکار فعال می‌کند:

- Middleware برای request context و span اصلی HTTP
- Interceptor برای اندازه‌گیری زمان اجرای Controller/Handler
- Exception Filter برای ثبت خطاهای مدیریت‌شده توسط Nest
- تمام قابلیت‌های Node SDK شامل خطاهای process، مانیتور `fetch` و event-loop

پاسخ‌های `HttpException` زیر ۵۰۰ به‌صورت پیش‌فرض ثبت نمی‌شوند. برای ثبت آن‌ها
`captureHttpExceptions: true` را فعال کنید.

## Trace و کپچر دستی

```ts
import { Injectable } from '@nestjs/common';
import { DidbanService, DidbanTrace } from '@didban/nestjs';

@Injectable()
export class OrdersService {
  constructor(private readonly didban: DidbanService) {}

  @DidbanTrace('orders.create', { slowThresholdMs: 500 })
  async create() {
    return this.didban.trace('database.insert', () => this.insertOrder());
  }

  async report(error: unknown) {
    await this.didban.captureException(error, { tags: { feature: 'orders' } });
  }
}
```

برای تنظیم async با `ConfigService` از `DidbanModule.forRootAsync({ useFactory, inject })`
استفاده کنید. هرکدام از integrationها را می‌توان با `enableMiddleware`، `enableInterceptor` و
`enableExceptionFilter` خاموش کرد.
