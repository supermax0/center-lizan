/**
 * دوال مشتركة: تنقل، تنسيق تاريخ/وقت، تحقق
 */
(function () {
  'use strict';

  function formatDate(d) {
    if (!d) return '—';
    const x = d instanceof Date ? d : (d.toDate ? d.toDate() : new Date(d));
    return x.toLocaleDateString('ar-EG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatTime(d) {
    if (!d) return '—';
    const x = d instanceof Date ? d : (d.toDate ? d.toDate() : new Date(d));
    return x.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDateTime(d) {
    return formatDate(d) + ' ' + formatTime(d);
  }

  /** تاريخ غدٍ منتصف الليل (للاستعلام) */
  function getTomorrowStart() {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(0, 0, 0, 0);
    return t;
  }

  /** نهاية يوم غدٍ */
  function getTomorrowEnd() {
    const t = getTomorrowStart();
    t.setDate(t.getDate() + 1);
    return t;
  }

  /** بداية اليوم الحالي */
  function getTodayStart() {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }

  /** نهاية اليوم الحالي */
  function getTodayEnd() {
    const t = new Date();
    t.setHours(23, 59, 59, 999);
    return t;
  }

  /** بداية الشهر الحالي */
  function getMonthStart() {
    const t = new Date();
    t.setDate(1);
    t.setHours(0, 0, 0, 0);
    return t;
  }

  /** نهاية الشهر الحالي */
  function getMonthEnd() {
    const t = new Date();
    t.setMonth(t.getMonth() + 1);
    t.setDate(0);
    t.setHours(23, 59, 59, 999);
    return t;
  }

  /** بداية الأسبوع الحالي (الأحد) */
  function getWeekStart() {
    const t = new Date();
    const day = t.getDay();
    t.setDate(t.getDate() - day);
    t.setHours(0, 0, 0, 0);
    return t;
  }

  /** نهاية الأسبوع الحالي */
  function getWeekEnd() {
    const t = getWeekStart();
    t.setDate(t.getDate() + 7);
    return t;
  }

  const SERVICE_TYPES = ['Laser', 'Botox', 'Filler', 'Skin Care', 'Custom Service'];
  const STATUS_LABELS = { scheduled: 'مجدول', completed: 'مكتمل', cancelled: 'ملغى' };

  window.utils = {
    formatDate,
    formatTime,
    formatDateTime,
    getTomorrowStart,
    getTomorrowEnd,
    getTodayStart,
    getTodayEnd,
    getMonthStart,
    getMonthEnd,
    getWeekStart,
    getWeekEnd,
    SERVICE_TYPES,
    STATUS_LABELS
  };
})();
