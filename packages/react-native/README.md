# @didban/react-native

SDK دیدبان برای اپلیکیشن‌های React Native و Expo.

```bash
npm install @didban/react-native
```

```ts
import Didban from '@didban/react-native';

Didban.init({
  apiKey: 'YOUR_API_KEY',
  appName: 'mobile-app',
  config: {
    baseUrl: 'https://your-didban-server.example',
    environment: 'production',
    release: 'mobile@1.0.0',
  },
});

Didban.setUser({ id: 'user-42' });
Didban.setCurrentRoute('Checkout', { cartId: 'cart-8' });
await Didban.capture(new Error('Payment failed'));
```

هر بار که route تغییر می‌کند `setCurrentRoute` را از listener کتابخانه‌ی navigation خود صدا بزنید.
SDK نام route را به گزارش و تغییر مسیر را به breadcrumb اضافه می‌کند.

## تنظیمات مخصوص React Native

| گزینه                        | پیش‌فرض | توضیح                                                         |
| ---------------------------- | ------- | ------------------------------------------------------------- |
| `captureAppErrors`           | `true`  | ثبت خطاهای JavaScript سراسری React Native                     |
| `captureUnhandledRejections` | `true`  | ثبت rejection در runtimeهایی که event مربوطه را ارائه می‌کنند |
| `captureNetwork`             | `true`  | رهگیری `fetch`                                                |
| `captureRequestBody`         | `true`  | ثبت بدنه‌ی درخواست پس از پاک‌سازی                             |
| `captureResponseBody`        | `true`  | ثبت بدنه‌ی پاسخ                                               |
| `reportFailedRequests`       | `true`  | ساخت گزارش برای پاسخ‌های HTTP ناموفق                          |
| `ignoreUrls`                 | `[]`    | URLها یا RegExpهای مستثنا                                     |
| `getDeviceContext`           | —       | افزودن اطلاعات سفارشی دستگاه به payload                       |

اطلاعات سیستم‌عامل، نسخه و ابعاد پنجره از `Platform` و `Dimensions` گرفته می‌شوند. این نسخه
خطاهای JavaScript را پوشش می‌دهد؛ ثبت crashهای native اندروید/iOS به native module جدا نیاز دارد.
