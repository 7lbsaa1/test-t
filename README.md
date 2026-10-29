# TeeStore — متجر تيشيرتات رجالية

HTML/CSS/JS نقي + Firebase + Vercel (Guest Checkout بدون حساب).

## 1) النشر على Vercel
1. ارفع المشروع إلى GitHub ثم: Vercel → New Project → Import.
2. لا Framework Preset — Static. اضبط Output عادي (بدون build).
3. أضف Domain (اختياري) ثم Deploy.

## 2) إنشاء مستخدم الأدمن
1. Firebase Console → Authentication → Sign-in method → فعّل **Email/Password**.
2. Users → Add User: أدمن@نطاقك.com + كلمة مرور قوية.

## 3) تعيين Custom Claim (admin: true)
```bash
npm i -g firebase-tools
firebase login
# أنشئ ملف setAdmin.mjs:
