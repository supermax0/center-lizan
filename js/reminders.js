/**
 * التذكيرات - منطق مرتبط بجلسات الغد و reminderSent
 * إرسال التذكير الفعلي يتم عبر Cloud Function يومياً (الساعة 9 صباحاً)
 * هذا الملف للاستخدام من الواجهة عند الحاجة (مثلاً عرض حالة التذكير)
 */
(function () {
  'use strict';

  window.reminders = {
    /** الحصول على جلسات الغد التي لم يُرسل لها تذكير بعد */
    getTomorrowPending: function () {
      if (typeof firebase === 'undefined') return Promise.resolve([]);
      const db = firebase.firestore();
      const tomorrowStart = utils.getTomorrowStart();
      const tomorrowEnd = utils.getTomorrowEnd();
      return db.collection('appointments')
        .where('sessionDate', '>=', tomorrowStart)
        .where('sessionDate', '<', tomorrowEnd)
        .where('reminderSent', '==', false)
        .where('status', '==', 'scheduled')
        .get()
        .then(function (snap) {
          return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        });
    }
  };
})();
