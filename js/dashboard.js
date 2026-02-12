/**
 * لوحة التحكم: إحصائيات، جلسات اليوم والغد، تنبيهات
 */
(function () {
  'use strict';

  const todayList = document.getElementById('todayList');
  const tomorrowList = document.getElementById('tomorrowList');
  const todayEmpty = document.getElementById('todayEmpty');
  const tomorrowEmpty = document.getElementById('tomorrowEmpty');
  const weekList = document.getElementById('weekList');
  const weekEmpty = document.getElementById('weekEmpty');
  const alertsList = document.getElementById('alertsList');
  const alertsEmpty = document.getElementById('alertsEmpty');
  const cardAlerts = document.getElementById('cardAlerts');

  function renderSession(s, showClient) {
    const client = showClient ? (s.clientName || '—') : '';
    const time = s.sessionTime || '—';
    const service = s.serviceType || '—';
    const status = utils.STATUS_LABELS[s.status] || s.status;
    const badge = s.status === 'scheduled' ? 'badge-scheduled' : s.status === 'completed' ? 'badge-completed' : 'badge-cancelled';
    return `
      <div class="list-item">
        <div class="info">
          <div class="name">${client} ${time}</div>
          <div class="meta">${service} · <span class="badge ${badge}">${status}</span></div>
        </div>
      </div>`;
  }

  function bindAuth() {
    if (!auth.redirectIfUnauthorized()) return;
    document.getElementById('headerEmail').textContent = auth.currentUser.email || '—';
    document.getElementById('headerRole').textContent = auth.roleLabel;
    document.getElementById('btnLogout').addEventListener('click', function (e) {
      e.preventDefault();
      auth.logout().then(function () { window.location.href = 'login.html'; });
    });
  }

  function loadDashboard() {
    if (typeof firebase === 'undefined') {
      todayEmpty.classList.remove('hide');
      tomorrowEmpty.classList.remove('hide');
      if (weekEmpty) weekEmpty.classList.remove('hide');
      alertsEmpty.classList.remove('hide');
      return;
    }
    const db = firebase.firestore();
    const todayStart = utils.getTodayStart();
    const todayEnd = utils.getTodayEnd();
    const tomorrowStart = utils.getTomorrowStart();
    const tomorrowEnd = utils.getTomorrowEnd();
    const weekStart = utils.getWeekStart();
    const weekEnd = utils.getWeekEnd();
    const monthStart = utils.getMonthStart();
    const monthEnd = utils.getMonthEnd();

    var ts = function (d) { return firebase.firestore.Timestamp.fromDate(d); };

    var todayQuery = db.collection('appointments').where('sessionDate', '>=', ts(todayStart)).where('sessionDate', '<=', ts(todayEnd));
    var tomorrowQuery = db.collection('appointments').where('sessionDate', '>=', ts(tomorrowStart)).where('sessionDate', '<=', ts(tomorrowEnd));
    var weekQuery = db.collection('appointments').where('sessionDate', '>=', ts(weekStart)).where('sessionDate', '<', ts(weekEnd));
    var monthQuery = db.collection('appointments').where('sessionDate', '>=', ts(monthStart)).where('sessionDate', '<=', ts(monthEnd));

    Promise.all([
      todayQuery.get(),
      tomorrowQuery.get(),
      weekQuery.get(),
      monthQuery.get(),
      db.collection('inventory').where('stock', '<=', 5).get().catch(function () { return { empty: true, size: 0 }; })
    ]).then(function ([todaySnap, tomorrowSnap, weekSnap, monthSnap, lowSnap]) {
      const today = todaySnap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      const tomorrow = tomorrowSnap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      const week = weekSnap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      const monthDocs = monthSnap.docs.map(function (d) { return d.data(); });
      const monthCount = monthDocs.filter(function (s) { return s.status === 'completed'; }).length;
      const lowStockCount = lowSnap.empty ? 0 : lowSnap.size;

      document.getElementById('statToday').textContent = today.length;
      document.getElementById('statTomorrow').textContent = tomorrow.length;
      document.getElementById('statMonth').textContent = monthCount;
      document.getElementById('statLowStock').textContent = lowStockCount;
      document.getElementById('statWeek').textContent = week.filter(function (s) { return s.status !== 'cancelled'; }).length;

      todayList.innerHTML = today.filter(function (s) { return s.status !== 'cancelled'; }).map(function (s) { return renderSession(s, true); }).join('') || '';
      tomorrowList.innerHTML = tomorrow.filter(function (s) { return s.status !== 'cancelled'; }).map(function (s) { return renderSession(s, true); }).join('') || '';
      weekList.innerHTML = week.filter(function (s) { return s.status !== 'cancelled'; }).sort(function (a, b) {
        const da = a.sessionDate && a.sessionDate.toDate ? a.sessionDate.toDate().getTime() : 0;
        const db = b.sessionDate && b.sessionDate.toDate ? b.sessionDate.toDate().getTime() : 0;
        return da - db;
      }).map(function (s) { return renderSession(s, true); }).join('') || '';
      todayEmpty.classList.toggle('hide', today.filter(function (s) { return s.status !== 'cancelled'; }).length > 0);
      tomorrowEmpty.classList.toggle('hide', tomorrow.filter(function (s) { return s.status !== 'cancelled'; }).length > 0);
      weekEmpty.classList.toggle('hide', week.filter(function (s) { return s.status !== 'cancelled'; }).length > 0);

      const alerts = [];
      if (lowStockCount > 0) alerts.push({ type: 'warning', text: 'منتجات منخفضة المخزون: ' + lowStockCount });
      if (alerts.length === 0) {
        alertsList.innerHTML = '';
        alertsEmpty.classList.remove('hide');
      } else {
        alertsEmpty.classList.add('hide');
        alertsList.innerHTML = alerts.map(function (a) {
          return '<div class="alert alert-' + a.type + '">' + a.text + '</div>';
        }).join('');
      }
    }).catch(function (err) {
      console.error('dashboard load', err);
      todayEmpty.classList.remove('hide');
      tomorrowEmpty.classList.remove('hide');
      if (weekEmpty) weekEmpty.classList.remove('hide');
      alertsEmpty.classList.remove('hide');
      if (typeof toast === 'function') toast('تعذر تحميل بيانات لوحة التحكم. تحقق من الاتصال أو قواعد Firestore.', 'error');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    auth.init().then(function () {
      if (!auth.redirectIfUnauthorized()) return;
      bindAuth();
      loadDashboard();
    });
  });
})();
