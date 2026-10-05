# @didban/browser-sdk

SDK مرورگر دیدبان برای ثبت خطاها، تعاملات کاربر و درخواست‌های شبکه.

```bash
npm install @didban/browser-sdk
```

```ts
import Didban from '@didban/browser-sdk';

Didban.init({
  apiKey: 'YOUR_API_KEY',
  appName: 'storefront-web',
  config: {
    baseUrl: 'https://your-didban-server.example',
    environment: 'production',
    release: 'web@1.4.0',
  },
});

Didban.setUser({ id: 'user-42' });
Didban.addClue('Checkout opened', { cartId: 'cart-8' });
await Didban.capture(new Error('Payment failed'));
```

به‌صورت خودکار کلیک و ورودی‌های DOM، خطاهای `window.error` و `unhandledrejection` و درخواست‌های
`fetch` و XHR ثبت می‌شوند. داده‌های دارای کلیدهایی مثل `password`، `token` و `apiKey` پیش از
ارسال فیلتر می‌شوند. بدنه‌ی پاسخ HTTP هیچ‌گاه در breadcrumb یا گزارش خطا ثبت و ارسال نمی‌شود.

خطاهای دارای شیء `Error` که در `console.error` ثبت می‌شوند نیز به‌صورت پیش‌فرض ارسال
می‌شوند. این مسیر خطاهای render گرفته‌شده توسط React Error Boundary را پوشش می‌دهد و با
`captureConsoleErrors: false` قابل غیرفعال‌کردن است.

درخواست‌های `fetch` و XHR که بیشتر از سه ثانیه طول بکشند نیز به‌صورت warning گزارش می‌شوند:

```ts
Didban.init({
  apiKey: 'YOUR_API_KEY',
  appName: 'storefront-web',
  config: {
    reportSlowRequests: true,
    slowRequestThresholdMs: 3_000,
  },
});
```

برای غیرفعال‌کردن این گزارش‌ها `reportSlowRequests: false` را تنظیم کنید.

به‌صورت پیش‌فرض، شناسه‌های پویا در مسیر URL (مانند عدد یا UUID) هنگام گروه‌بندی نادیده گرفته
می‌شوند. برای endpointهایی که هر شناسه باید issue جدا بسازد، آدرس یا الگوی آن‌ها را در
`separateHttpUrls` قرار دهید. مقدارهای query در هر دو حالت وارد fingerprint نمی‌شوند.

```ts
Didban.init({
  apiKey: 'YOUR_API_KEY',
  appName: 'storefront-web',
  config: {
    separateHttpUrls: ['/api/v1/maintenance/service/timeline/', /\/api\/v1\/orders\/\d+$/],
  },
});
```
