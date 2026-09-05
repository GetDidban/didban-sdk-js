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
SDK نام route را به گزارش و تغییر مسیر را به breadcrumb اضافه می‌کند. از زمان ثبت route، نرخ
فریم همان صفحه نیز نمونه‌برداری می‌شود. اگر FPS یا درصد slow frame از حد تنظیم‌شده عبور کند، یک
گزارش warning با route و جزئیات performance ارسال خواهد شد.

آخرین وضعیت پنجره‌ی نمونه‌برداری جاری نیز قابل دریافت است:

```ts
const metrics = Didban.getScreenPerformance();
// { route, averageFps, slowFrames, droppedFrames, worstFrameMs, ... }
```

## تنظیمات مخصوص React Native

| گزینه                          | پیش‌فرض | توضیح                                                         |
| ------------------------------ | ------- | ------------------------------------------------------------- |
| `captureAppErrors`             | `true`  | ثبت خطاهای JavaScript سراسری React Native                     |
| `captureUnhandledRejections`   | `true`  | ثبت rejection در runtimeهایی که event مربوطه را ارائه می‌کنند |
| `captureNetwork`               | `true`  | رهگیری `fetch`                                                |
| `captureRequestBody`           | `true`  | ثبت بدنه‌ی درخواست پس از پاک‌سازی                             |
| `captureResponseBody`          | `true`  | ثبت بدنه‌ی پاسخ                                               |
| `reportFailedRequests`         | `true`  | ساخت گزارش برای پاسخ‌های HTTP ناموفق                          |
| `ignoreUrls`                   | `[]`    | URLها یا RegExpهای مستثنا                                     |
| `getDeviceContext`             | —       | افزودن اطلاعات سفارشی دستگاه به payload                       |
| `enableScreenProfiling`        | `true`  | فعال‌سازی پروفایلینگ صفحه پس از `setCurrentRoute`             |
| `reportFpsDrops`               | `true`  | ارسال warning هنگام افت عملکرد                                |
| `fpsSampleWindowMs`            | `5000`  | طول هر پنجره‌ی نمونه‌برداری                                   |
| `minimumFps`                   | `50`    | حداقل FPS قابل قبول                                           |
| `slowFrameThresholdMs`         | `32`    | زمان فریمی که slow محسوب می‌شود                               |
| `slowFramePercentageThreshold` | `20`    | حداکثر درصد slow frame قابل قبول                              |
| `fpsReportCooldownMs`          | `30000` | فاصله‌ی حداقل بین دو گزارش یک route                           |

اطلاعات سیستم‌عامل، نسخه و ابعاد پنجره از `Platform` و `Dimensions` گرفته می‌شوند. این نسخه
خطاهای JavaScript را پوشش می‌دهد. معیار FPS فعلی مربوط به thread جاوااسکریپت است؛ اندازه‌گیری
مستقیم UI thread و ثبت crashهای native اندروید/iOS به native module جدا نیاز دارد. نتایج performance
را روی build نوع release ارزیابی کنید، چون حالت development سربار بیشتری دارد.
