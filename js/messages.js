/**
 * نظام الرسائل - صندوق الوارد، عرض، إرسال (لمستخدم أو للكل)
 */
(function () {
  'use strict';

  var listEl = document.getElementById('messagesList');
  var emptyEl = document.getElementById('messagesEmpty');
  var loadingEl = document.getElementById('messagesLoading');
  var summaryEl = document.getElementById('messagesSummary');
  var btnNew = document.getElementById('btnNewMessage');
  var modalView = document.getElementById('modalViewMessage');
  var modalCompose = document.getElementById('modalCompose');
  var formMessage = document.getElementById('formMessage');
  var msgTo = document.getElementById('msgTo');
  var msgSubject = document.getElementById('msgSubject');
  var msgBody = document.getElementById('msgBody');
  var btnCancelCompose = document.getElementById('btnCancelCompose');
  var viewSubject = document.getElementById('viewSubject');
  var viewFrom = document.getElementById('viewFrom');
  var viewDate = document.getElementById('viewDate');
  var viewBody = document.getElementById('viewBody');
  var btnCloseView = document.getElementById('btnCloseView');

  function showLoading(show) {
    loadingEl.classList.toggle('hide', !show);
    listEl.style.opacity = show ? '0.5' : '1';
  }

  function formatMessageDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('ar-EG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function openView(msg) {
    viewSubject.textContent = msg.subject || '—';
    viewFrom.textContent = (msg.fromName || '—') + (msg.toUid === 'all' ? ' (إلى الكل)' : '');
    viewDate.textContent = formatMessageDate(msg.createdAt);
    viewBody.textContent = msg.body || '—';
    modalView.classList.add('show');
    if (typeof firebase !== 'undefined' && msg.id && !msg.read) {
      firebase.firestore().collection('messages').doc(msg.id).update({ read: true }).catch(function () {});
    }
  }

  function openCompose() {
    msgSubject.value = '';
    msgBody.value = '';
    modalCompose.classList.add('show');
  }

  function closeCompose() {
    modalCompose.classList.remove('show');
  }

  function loadUsersForCompose() {
    if (typeof firebase === 'undefined') return;
    firebase.firestore().collection('users').get().then(function (snap) {
      var opts = '<option value="all">الكل (جميع المستخدمين)</option>';
      snap.docs.forEach(function (d) {
        if (d.id === auth.currentUser.uid) return;
        var data = d.data();
        opts += '<option value="' + d.id + '">' + (data.displayName || data.email || d.id) + '</option>';
      });
      msgTo.innerHTML = opts;
    });
  }

  function loadMessages() {
    if (typeof firebase === 'undefined') {
      emptyEl.classList.remove('hide');
      return;
    }
    showLoading(true);
    var uid = auth.currentUser.uid;
    var coll = firebase.firestore().collection('messages');
    Promise.all([
      coll.where('toUid', '==', uid).get(),
      coll.where('toUid', '==', 'all').get()
    ]).then(function ([toMeSnap, toAllSnap]) {
        var seen = {};
        var items = [];
        toMeSnap.docs.forEach(function (d) {
          items.push(Object.assign({ id: d.id }, d.data()));
          seen[d.id] = true;
        });
        toAllSnap.docs.forEach(function (d) {
          if (!seen[d.id]) items.push(Object.assign({ id: d.id }, d.data()));
        });
        items.sort(function (a, b) {
          var ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : 0;
          var tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : 0;
          return tb - ta;
        });
        var unread = items.filter(function (m) { return !m.read; }).length;
        if (summaryEl) summaryEl.textContent = items.length + ' رسالة' + (unread ? ' · ' + unread + ' غير مقروءة' : '');
        if (!items.length) {
          listEl.innerHTML = '';
          emptyEl.classList.remove('hide');
        } else {
          emptyEl.classList.add('hide');
          listEl.innerHTML = items.map(function (m) {
            var readClass = m.read ? '' : ' message-unread';
            return '<div class="list-item' + readClass + '" data-id="' + m.id + '">' +
              '<div class="info">' +
                '<div class="name">' + (m.subject || '—') + '</div>' +
                '<div class="meta">' + (m.fromName || '—') + ' · ' + formatMessageDate(m.createdAt) + '</div>' +
              '</div>' +
            '</div>';
          }).join('');
          listEl.querySelectorAll('[data-id]').forEach(function (el) {
            el.addEventListener('click', function () {
              var id = el.getAttribute('data-id');
              var msg = items.find(function (x) { return x.id === id; });
              if (msg) openView(msg);
            });
          });
        }
      })
      .catch(function (err) {
        console.error('loadMessages', err);
        listEl.innerHTML = '';
        emptyEl.classList.remove('hide');
        toast('تعذر تحميل الرسائل.', 'error');
      })
      .finally(function () { showLoading(false); });
  }

  function sendMessage(e) {
    e.preventDefault();
    var toUid = msgTo.value.trim();
    var subject = msgSubject.value.trim();
    var body = msgBody.value.trim();
    if (!subject || !body) {
      toast('الموضوع والنص مطلوبان', 'warning');
      return;
    }
    var toName = toUid === 'all' ? 'الكل' : msgTo.options[msgTo.selectedIndex].text;
    var payload = {
      fromUid: auth.currentUser.uid,
      fromName: auth.currentUser.email || auth.currentUser.displayName || '—',
      toUid: toUid,
      toName: toName,
      subject: subject,
      body: body,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    firebase.firestore().collection('messages').add(payload).then(function () {
      closeCompose();
      loadMessages();
      toast('تم إرسال الرسالة', 'success');
    }).catch(function (err) {
      toast('خطأ: ' + (err.message || err), 'error');
    });
  }

  function bindAuth() {
    if (!auth.redirectIfUnauthorized()) return;
    document.getElementById('headerRole').textContent = auth.roleLabel;
    document.getElementById('btnLogout').addEventListener('click', function (e) {
      e.preventDefault();
      auth.logout().then(function () { window.location.href = 'login.html'; });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    auth.init().then(function () {
      if (!auth.redirectIfUnauthorized()) return;
      bindAuth();
      loadUsersForCompose();
      loadMessages();
      btnNew.addEventListener('click', openCompose);
      formMessage.addEventListener('submit', sendMessage);
      btnCancelCompose.addEventListener('click', closeCompose);
      btnCloseView.addEventListener('click', function () { modalView.classList.remove('show'); });
      modalView.addEventListener('click', function (e) { if (e.target === modalView) modalView.classList.remove('show'); });
      modalCompose.addEventListener('click', function (e) { if (e.target === modalCompose) closeCompose(); });
    });
  });
})();
