# Didban JavaScript SDKs

مخزن چندپکیجی SDK دیدبان برای مرورگر و React Native است. منطق مشترک ارسال گزارش، پاک‌سازی
داده‌ها و breadcrumbها در `@didban/core` قرار دارد و هر محیط instrumentation مخصوص خودش را
دارد.

## پکیج‌ها

| پکیج                   | کاربرد                                                       |
| ---------------------- | ------------------------------------------------------------ |
| `@didban/browser-sdk`  | وب، DOM، خطاهای `window` و رهگیری `fetch`/XHR                |
| `@didban/react-native` | React Native و Expo، خطاهای JavaScript، navigation و `fetch` |
| `@didban/core`         | هسته‌ی مشترک؛ معمولاً مستقیم نصب نمی‌شود                     |

## توسعه

```bash
npm install
npm run typecheck
npm test
npm run build
npm run format:check
```

برای بررسی محتوای پکیج‌ها پیش از انتشار:

```bash
npm run pack:check
```

برای انتشار، ابتدا `@didban/core` و سپس پکیج‌های پلتفرم را منتشر کنید.
