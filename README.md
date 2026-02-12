# نظام إدارة مركز التجميل

نظام ويب كامل لإدارة مركز تجميل: حجوزات، عملاء، مخزون، تذكيرات.  
**تقنيات:** HTML5 + CSS3 + JavaScript (Vanilla) + Firebase (Auth, Firestore, Cloud Functions).

---

## المميزات

- **أدوار المستخدمين:** مدير، طبيب، استقبال، مخزون، عميل
- **الحجوزات والجلسات:** إضافة، تعديل، إكمال، إلغاء — مع فلترة بالتاريخ والحالة
- **ملفات العملاء:** الاسم، الهاتف، ملاحظات طبية، سجل الجلسات
- **المخزون:** منتجات، كمية، حد تنبيه، تاريخ صلاحية، خصم تلقائي عند إكمال الجلسة
- **التذكير اليومي:** Cloud Function يومياً 9 صباحاً (توقيت بغداد) للجلسات غداً
- **لوحة تحكم:** جلسات اليوم والغد، إحصائيات شهرية، تنبيه مخزون منخفض
- **واجهة:** RTL، متجاوبة مع الهواتف، ألوان أبيض + وردي فاتح + ذهبي

---

## التشغيل المحلي

1. **إنشاء مشروع Firebase**
   - [Firebase Console](https://console.firebase.google.com) → إنشاء مشروع
   - تفعيل **Authentication** (البريد/كلمة المرور)
   - إنشاء **Firestore**
   - في إعدادات المشروع انسخ بيانات التطبيق (Web)

2. **إعداد الإعدادات**
   - افتح `firebase/firebase-config.js` وضع قيم مشروعك:
     - `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`

3. **قواعد Firestore**
   - في Firebase Console → Firestore → قواعد، الصق محتوى ملف `firestore.rules`
   - أو استخدم: `firebase deploy --only firestore:rules` بعد تثبيت Firebase CLI

4. **مستخدم تجريبي (مدير)**
   - Authentication → إضافة مستخدم (بريد + كلمة مرور)
   - Firestore → مجموعة `users` → إنشاء مستند بالـ UID كمعرف المستند
   - الحقول: `role: "admin"`, `displayName: "مدير"` (أو كما تريد)

5. **فتح الموقع**
   - استضف الملفات على خادم محلي (مثلاً Live Server في VS Code) أو ارفعها إلى استضافة ثابتة
   - أو: `firebase init hosting` ثم `firebase deploy --only hosting`

---

## Cloud Functions (التذكير + واتساب)

- الدالة `sendTomorrowReminders` تعمل يومياً الساعة 9 صباحاً (Asia/Baghdad).
- تبحث عن جلسات غداً التي `reminderSent === false` و`status === "scheduled"`، ترسل **رسالة تذكير عبر واتساب** لصاحب الجلسة (رقم العميل)، تحدث `reminderSent = true` وتُسجّل في `client_reminders`.
- الدالة القابلة للاستدعاء `sendReminderWhatsApp` تُستدعى من التطبيق عند الضغط على زر "تذكير" في الحجوزات، وترسل نفس التذكير عبر واتساب.

### إعداد إرسال واتساب (Twilio)

1. إنشاء حساب في [Twilio](https://www.twilio.com) والحصول على **Account SID** و **Auth Token**.
2. تفعيل [WhatsApp Sandbox](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn) أو الحصول على رقم واتساب معتمد.
3. تعيين إعدادات الدوال في Firebase:
   ```bash
   firebase functions:config:set twilio.account_sid="ACxxxxxxxx" twilio.auth_token="xxxxxxxx" twilio.whatsapp_from="whatsapp:+14155238886"
   ```
   (استبدل القيم بقيمك؛ `whatsapp_from` للـ Sandbox يكون عادة `whatsapp:+14155238886`).
4. إعادة نشر الدوال: `firebase deploy --only functions`.
5. أرقام العملاء يجب أن تكون مسجلة في واتساب؛ في Sandbox يجب أن يرسل العميل كلمة معينة لرقم Twilio أولاً لتفعيل الاستقبال.
- إرسال البريد الفعلي: يمكن ربط امتداد **Trigger Email** أو SendGrid من داخل الدالة (النص الجاهز في الدالة).

لتثبيت ونشر الدوال:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

---

## هيكل الملفات

```
Center-Lizan/
├── index.html          # لوحة التحكم
├── login.html          # تسجيل الدخول
├── appointments.html   # الحجوزات
├── clients.html        # العملاء
├── inventory.html      # المخزون
├── css/
│   └── style.css       # التنسيق الموحد
├── js/
│   ├── auth.js         # المصادقة والأدوار
│   ├── common.js       # تنسيق تاريخ/وقت وثوابت
│   ├── dashboard.js   # لوحة التحكم
│   ├── appointments.js # إدارة الحجوزات
│   ├── clients.js      # إدارة العملاء
│   ├── inventory.js    # إدارة المخزون
│   └── reminders.js    # مساعد التذكيرات (الواجهة)
├── firebase/
│   └── firebase-config.js
├── functions/
│   ├── index.js        # دالة التذكير اليومي
│   └── package.json
├── firestore.rules
├── firebase.json
└── README.md
```

---

## ملاحظات

- **الفهارس المركبة:** إذا طلب Firestore إنشاء فهرس مركب، انقر على الرابط في رسالة الخطأ لإنشائه من واجهة Firebase.
- **البريد للتذكير:** لإرسال بريد حقيقي، استخدم امتداد Trigger Email أو أضف في الدالة استدعاء SendGrid/Mailgun حسب البريد المُعد في المشروع.

تم بناء النظام حسب المواصفات في ملف **ASAS** بدون نقص، مع تصميم احترافي ومناسب للهواتف.
