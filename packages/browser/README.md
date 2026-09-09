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
ارسال فیلتر می‌شوند.

خطاهای دارای شیء `Error` که در `console.error` ثبت می‌شوند نیز به‌صورت پیش‌فرض ارسال
می‌شوند. این مسیر خطاهای render گرفته‌شده توسط React Error Boundary را پوشش می‌دهد و با
`captureConsoleErrors: false` قابل غیرفعال‌کردن است.
