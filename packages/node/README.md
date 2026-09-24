# @didban/node-sdk

SDK نود جی‌اس دیدبان برای ثبت خودکار خطاها، trace کردن عملیات و تشخیص کندی است.

```bash
npm install @didban/node-sdk
```

```ts
import { Didban } from '@didban/node-sdk';

Didban.init({
  apiKey: process.env.DIDBAN_API_KEY!,
  appName: 'payment-service',
  config: { environment: 'production', release: '1.4.0' },
});

const order = await Didban.trace('create-order', async (span) => {
  span.setAttribute('customerId', customerId);
  return createOrder(customerId);
});

await Didban.captureException(error, { tags: { feature: 'checkout' } });
await Didban.captureMessage('Queue is almost full', { level: 'warning' });
```

خطاهای `uncaughtException` و `unhandledRejection`، درخواست‌های ناموفق یا کند `fetch` و کندی
event loop به‌صورت پیش‌فرض ثبت می‌شوند. برای Express/Connect:

```ts
app.use(Didban.requestHandler());
// routeها
app.use(Didban.errorHandler());
```

برای خاموش‌کردن هر instrumentation یا تغییر آستانه‌ها، گزینه‌های `captureFetch`،
`monitorEventLoop`، `reportSlowOperations`، `slowRequestThresholdMs` و
`slowOperationThresholdMs` را در `config`
تنظیم کنید. هدرهای HTTP به‌دلایل امنیتی به‌صورت پیش‌فرض ذخیره نمی‌شوند.
