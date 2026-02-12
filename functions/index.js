/**
 * Cloud Functions - نظام إدارة مركز التجميل
 * التذكير اليومي للجلسات غداً (9 صباحاً) + إرسال التذكير عبر واتساب (Twilio)
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const twilio = require("twilio");
admin.initializeApp();

const db = admin.firestore();

/** تحويل رقم الهاتف إلى صيغة واتساب (مثلاً 07xxxxxxxx → +9647xxxxxxxx) */
function toWhatsAppPhone(phone) {
  if (!phone || typeof phone !== "string") return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("964")) return "+" + digits;
  if (digits.startsWith("0") && digits.length >= 10) return "+964" + digits.slice(1);
  if (digits.length >= 9) return "+964" + digits.slice(-9);
  return "+964" + digits;
}

/** إرسال رسالة واتساب عبر Twilio (يتطلب إعداد TWILIO في Firebase Config) */
async function sendWhatsApp(toPhone, body) {
  const config = functions.config();
  const accountSid = config.twilio && config.twilio.account_sid;
  const authToken = config.twilio && config.twilio.auth_token;
  const from = config.twilio && config.twilio.whatsapp_from;
  if (!accountSid || !authToken || !from) {
    console.warn("[WhatsApp] Twilio not configured. Set: firebase functions:config:set twilio.account_sid=... twilio.auth_token=... twilio.whatsapp_from=whatsapp:+14155238886");
    return { ok: false, reason: "not_configured" };
  }
  const to = toWhatsAppPhone(toPhone);
  if (!to) {
    console.warn("[WhatsApp] Invalid phone:", toPhone);
    return { ok: false, reason: "invalid_phone" };
  }
  try {
    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({
      body,
      from: from.startsWith("whatsapp:") ? from : "whatsapp:" + from,
      to: to.startsWith("whatsapp:") ? to : "whatsapp:" + to,
    });
    return { ok: true, sid: result.sid };
  } catch (e) {
    console.error("[WhatsApp] Send error:", e.message);
    return { ok: false, reason: e.message };
  }
}

/**
 * يومياً الساعة 9 صباحاً (Asia/Baghdad):
 * تجلب الجلسات التي sessionDate = غداً و reminderSent = false
 * ترسل تذكير (Email placeholder - يمكن ربط SendGrid أو Mailgun لاحقاً)
 * تحدث reminderSent = true
 */
exports.sendTomorrowReminders = functions.pubsub
  .schedule("0 9 * * *")
  .timeZone("Asia/Baghdad")
  .onRun(async (context) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const afterTomorrow = new Date(tomorrow);
    afterTomorrow.setDate(afterTomorrow.getDate() + 1);

    const snapshot = await db.collection("appointments")
      .where("sessionDate", ">=", admin.firestore.Timestamp.fromDate(tomorrow))
      .where("sessionDate", "<", admin.firestore.Timestamp.fromDate(afterTomorrow))
      .where("reminderSent", "==", false)
      .where("status", "==", "scheduled")
      .get();

    const batch = db.batch();
    const remindersLog = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const clientId = data.clientId;
      let clientName = data.clientName || "العميل";
      let clientEmail = null;
      let clientPhone = null;

      if (clientId) {
        try {
          const clientDoc = await db.collection("clients").doc(clientId).get();
          if (clientDoc.exists) {
            const c = clientDoc.data();
            clientName = c.name || clientName;
            clientEmail = c.email || null;
            clientPhone = c.phone || null;
          }
        } catch (e) {
          console.warn("client fetch error", clientId, e.message);
        }
      }

      const sessionTime = data.sessionTime || "—";
      const serviceType = data.serviceType || "—";
      const subject = "تذكير بموعد جلستك غداً - مركز التجميل";
      const messageBody = `نذكّرك بموعد جلستك غدًا في مركز التجميل\n🕒 الوقت: ${sessionTime}\n💉 الخدمة: ${serviceType}\n📍 نتشرف بحضورك`;

      remindersLog.push({ clientName, clientEmail, clientPhone, messageBody });

      // حفظ رسالة التذكير لصاحب الجلسة (قبل يوم)
      await db.collection("client_reminders").add({
        appointmentId: doc.id,
        clientId: clientId || null,
        clientName,
        clientPhone: clientPhone || null,
        clientEmail: clientEmail || null,
        subject,
        body: messageBody,
        sessionDate: data.sessionDate,
        sessionTime,
        serviceType,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentBy: "system",
        channel: "reminder_day_before"
      });

      // إرسال التذكير عبر واتساب لصاحب الجلسة
      if (clientPhone) {
        const wa = await sendWhatsApp(clientPhone, messageBody);
        if (wa.ok) console.log(`[WhatsApp] Sent to ${clientPhone} (${clientName})`);
        else console.warn(`[WhatsApp] Failed for ${clientPhone}:`, wa.reason);
      }
      if (clientEmail) {
        console.log(`[Reminder Email] To: ${clientEmail} | ${clientName}`);
      }

      batch.update(doc.ref, { reminderSent: true });
    }

    await batch.commit();

    // حفظ سجل في collection reminders (اختياري)
    if (remindersLog.length) {
      await db.collection("reminders").add({
        type: "tomorrow",
        runAt: admin.firestore.FieldValue.serverTimestamp(),
        count: remindersLog.length,
        items: remindersLog
      });
    }

    return null;
  });

/**
 * استدعاء من التطبيق: إرسال تذكير واتساب لصاحب الجلسة (زر "تذكير")
 * يتطلب إعداد Twilio في Firebase Config
 */
exports.sendReminderWhatsApp = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "يجب تسجيل الدخول");
  }
  const appointmentId = data.appointmentId;
  if (!appointmentId) {
    throw new functions.https.HttpsError("invalid-argument", "معرف الحجز مطلوب");
  }

  const appointmentRef = db.collection("appointments").doc(appointmentId);
  const appointmentSnap = await appointmentRef.get();
  if (!appointmentSnap.exists) {
    throw new functions.https.HttpsError("not-found", "الحجز غير موجود");
  }
  const appointment = appointmentSnap.data();
  if (appointment.reminderSent) {
    return { ok: true, message: "تم إرسال التذكير مسبقاً" };
  }

  let clientName = appointment.clientName || "العميل";
  let clientPhone = null;
  let clientEmail = null;
  const clientId = appointment.clientId;
  if (clientId) {
    const clientSnap = await db.collection("clients").doc(clientId).get();
    if (clientSnap.exists) {
      const c = clientSnap.data();
      clientName = c.name || clientName;
      clientPhone = c.phone || null;
      clientEmail = c.email || null;
    }
  }

  const sessionTime = appointment.sessionTime || "—";
  const serviceType = appointment.serviceType || "—";
  const sessionDate = appointment.sessionDate;
  const dateStr = sessionDate && sessionDate.toDate ? sessionDate.toDate().toLocaleDateString("ar-EG") : "—";
  const subject = "تذكير بموعد جلستك - مركز التجميل";
  const body = `نذكّرك بموعد جلستك في مركز التجميل.\n🕒 التاريخ: ${dateStr}\n🕒 الوقت: ${sessionTime}\n💉 الخدمة: ${serviceType}\n📍 نتشرف بحضورك`;

  let whatsAppSent = false;
  if (clientPhone) {
    const wa = await sendWhatsApp(clientPhone, body);
    whatsAppSent = wa.ok;
  }

  await db.collection("client_reminders").add({
    appointmentId,
    clientId: clientId || null,
    clientName,
    clientPhone: clientPhone || null,
    clientEmail: clientEmail || null,
    subject,
    body,
    sessionDate: appointment.sessionDate,
    sessionTime,
    serviceType,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    sentBy: context.auth.uid,
    channel: "reminder_manual",
    whatsAppSent,
  });
  await appointmentRef.update({ reminderSent: true });

  return {
    ok: true,
    whatsAppSent,
    message: whatsAppSent ? "تم إرسال التذكير عبر واتساب" : (clientPhone ? "فشل إرسال واتساب (تحقق من إعداد Twilio)" : "لا يوجد رقم هاتف للعميل"),
  };
});
