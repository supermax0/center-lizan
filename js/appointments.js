/**
 * إدارة الحجوزات والجلسات - عرض، إضافة، تعديل، إكمال، إلغاء
 */
(function () {
  'use strict';

  const listEl = document.getElementById('appointmentsList');
  const emptyEl = document.getElementById('appointmentsEmpty');
  const loadingEl = document.getElementById('appointmentsLoading');
  const filterDate = document.getElementById('filterDate');
  const filterStatus = document.getElementById('filterStatus');
  const filterService = document.getElementById('filterService');
  const searchClient = document.getElementById('searchClient');
  const btnFilter = document.getElementById('btnFilter');
  const btnAdd = document.getElementById('btnAddAppointment');
  const modal = document.getElementById('modalAppointment');
  const form = document.getElementById('formAppointment');
  const modalTitle = document.getElementById('modalTitle');
  const appId = document.getElementById('appointmentId');
  const appClient = document.getElementById('appClient');
  const appService = document.getElementById('appService');
  const appDoctor = document.getElementById('appDoctor');
  const appStatus = document.getElementById('appStatus');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const sessionsList = document.getElementById('sessionsList');
  const btnAddSession = document.getElementById('btnAddSession');
  const groupSessions = document.getElementById('groupSessions');
  var currentView = 'all';

  function setDefaultDate() {
    const d = new Date();
    filterDate.value = d.toISOString().slice(0, 10);
  }

  function showLoading(show) {
    loadingEl.classList.toggle('hide', !show);
    listEl.style.opacity = show ? '0.5' : '1';
  }

  function getDefaultDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function addSessionRow(dateVal, timeVal) {
    const row = document.createElement('div');
    row.className = 'session-row';
    row.innerHTML =
      '<input type="date" class="form-control session-date" value="' + (dateVal || getDefaultDate()) + '">' +
      '<input type="time" class="form-control session-time" value="' + (timeVal || '') + '">' +
      '<button type="button" class="btn btn-sm btn-outline session-remove" title="حذف الجلسة">حذف</button>';
    sessionsList.appendChild(row);
    row.querySelector('.session-remove').addEventListener('click', function () {
      if (sessionsList.querySelectorAll('.session-row').length > 1) row.remove();
    });
  }

  function getSessionsFromForm() {
    const rows = sessionsList.querySelectorAll('.session-row');
    const out = [];
    rows.forEach(function (r) {
      const date = (r.querySelector('.session-date') && r.querySelector('.session-date').value) || '';
      const time = (r.querySelector('.session-time') && r.querySelector('.session-time').value) || '';
      if (date && time) out.push({ date: date, time: time });
    });
    return out;
  }

  function openModal(editData) {
    appId.value = editData ? editData.id : '';
    modalTitle.textContent = editData ? 'تعديل الحجز' : 'حجز جديد';
    sessionsList.innerHTML = '';
    if (editData) {
      appClient.value = editData.clientId || '';
      appService.value = editData.serviceType || 'Laser';
      appDoctor.value = editData.doctorId || '';
      appStatus.value = editData.status || 'scheduled';
      const d = editData.sessionDate ? (editData.sessionDate.toDate ? editData.sessionDate.toDate() : new Date(editData.sessionDate)) : new Date();
      addSessionRow(d.toISOString().slice(0, 10), editData.sessionTime || '');
      btnAddSession.classList.add('hide');
    } else {
      form.reset();
      appId.value = '';
      appStatus.value = 'scheduled';
      addSessionRow(getDefaultDate(), '');
      btnAddSession.classList.remove('hide');
    }
    modal.classList.add('show');
  }

  function closeModal() {
    modal.classList.remove('show');
  }

  function loadClients() {
    if (typeof firebase === 'undefined') return;
    firebase.firestore().collection('clients').orderBy('name').get().then(function (snap) {
      appClient.innerHTML = '<option value="">اختر العميل</option>' + snap.docs.map(function (d) {
        const d_ = d.data();
        return '<option value="' + d.id + '">' + (d_.name || '—') + ' - ' + (d_.phone || '') + '</option>';
      }).join('');
    });
  }

  function loadDoctors() {
    if (typeof firebase === 'undefined') return;
    firebase.firestore().collection('users').where('role', '==', 'doctor').get().then(function (snap) {
      appDoctor.innerHTML = '<option value="">—</option>' + snap.docs.map(function (d) {
        const d_ = d.data();
        return '<option value="' + d.id + '">' + (d_.displayName || d_.email || d.id) + '</option>';
      }).join('');
    });
  }

  function getClientName(clientId) {
    return new Promise(function (resolve) {
      if (!clientId) { resolve('—'); return; }
      firebase.firestore().collection('clients').doc(clientId).get().then(function (doc) {
        resolve(doc.exists ? (doc.data().name || '—') : '—');
      }).catch(function () { resolve('—'); });
    });
  }

  function renderList(items) {
    if (!items.length) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hide');
      return;
    }
    emptyEl.classList.add('hide');
    var withNames = items.map(function (a) {
      return Object.assign({}, a, { clientName: a.clientName || '—' });
    });
    listEl.innerHTML = withNames.map(function (a) {
      var dateStr = a.sessionDate ? (a.sessionDate.toDate ? a.sessionDate.toDate().toISOString().slice(0, 10) : a.sessionDate) : '—';
      var badge = a.status === 'scheduled' ? 'badge-scheduled' : a.status === 'completed' ? 'badge-completed' : 'badge-cancelled';
      var statusLabel = utils.STATUS_LABELS[a.status] || a.status;
      return '<div class="list-item">' +
        '<div class="info">' +
          '<div class="name">' + (a.clientName || '—') + ' · ' + (a.sessionTime || '—') + '</div>' +
          '<div class="meta">' + (a.serviceType || '—') + ' | ' + dateStr + ' · <span class="badge ' + badge + '">' + statusLabel + '</span></div>' +
        '</div>' +
        '<div class="actions">' +
          '<div class="options-dropdown" data-id="' + a.id + '">' +
            '<button type="button" class="options-trigger" aria-expanded="false">خيارات ▾</button>' +
            '<div class="options-menu" role="menu">' +
              '<button type="button" role="menuitem" data-action="edit" data-id="' + a.id + '">تعديل</button>' +
              (a.status === 'scheduled' ? '<button type="button" role="menuitem" data-action="complete" data-id="' + a.id + '">إكمال</button>' : '') +
              (a.status === 'scheduled' ? '<button type="button" role="menuitem" data-action="remind" data-id="' + a.id + '">تذكير</button>' : '') +
              (a.status === 'scheduled' ? '<button type="button" role="menuitem" data-action="whatsapp" data-id="' + a.id + '">واتساب</button>' : '') +
              (a.status !== 'cancelled' ? '<button type="button" role="menuitem" data-action="cancel" data-id="' + a.id + '">إلغاء</button>' : '') +
              '<button type="button" role="menuitem" data-action="delete" data-id="' + a.id + '">حذف</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    listEl.querySelectorAll('.options-dropdown').forEach(function (dropdown) {
      var trigger = dropdown.querySelector('.options-trigger');
      var menu = dropdown.querySelector('.options-menu');
      var id = dropdown.getAttribute('data-id');
      var item = items.find(function (x) { return x.id === id; });

      function closeAllDropdowns() {
        listEl.querySelectorAll('.options-dropdown.open').forEach(function (d) {
          d.classList.remove('open');
          var t = d.querySelector('.options-trigger');
          if (t) t.setAttribute('aria-expanded', 'false');
        });
      }

      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = dropdown.classList.toggle('open');
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        listEl.querySelectorAll('.options-dropdown').forEach(function (d) {
          if (d !== dropdown) {
            d.classList.remove('open');
            var t = d.querySelector('.options-trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
          }
        });
      });

      menu.querySelectorAll('[data-action]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var action = btn.getAttribute('data-action');
          closeAllDropdowns();
          if (action === 'edit') openModal(item);
          else if (action === 'complete') setStatus(id, 'completed');
          else if (action === 'remind') sendReminder(id, item);
          else if (action === 'whatsapp') openWhatsAppManual(item);
          else if (action === 'cancel') confirmDialog('إلغاء هذا الحجز؟', function () { setStatus(id, 'cancelled'); });
          else if (action === 'delete') confirmDialog('حذف هذا الحجز نهائياً؟', function () { deleteAppointment(id); });
        });
      });
    });
  }

  function deleteAppointment(appointmentId) {
    if (typeof firebase === 'undefined') return;
    firebase.firestore().collection('appointments').doc(appointmentId).delete()
      .then(function () {
        loadAppointments();
        toast('تم حذف الحجز', 'success');
      })
      .catch(function (e) {
        toast('خطأ: ' + (e.message || e), 'error');
      });
  }

  function setStatus(id, status) {
    if (typeof firebase === 'undefined') return;
    firebase.firestore().collection('appointments').doc(id).update({ status: status }).then(function () {
      loadAppointments();
      if (status === 'completed') deductInventoryForAppointment(id);
      toast(status === 'cancelled' ? 'تم إلغاء الحجز' : 'تم تحديث الحالة', 'success');
    }).catch(function (e) { toast('خطأ: ' + (e.message || e), 'error'); });
  }

  function toWhatsAppNumber(phone) {
    if (!phone || typeof phone !== 'string') return null;
    var digits = phone.replace(/\D/g, '');
    if (digits.length < 9) return null;
    if (digits.startsWith('964')) return digits;
    if (digits.startsWith('0') && digits.length >= 10) return '964' + digits.slice(1);
    return '964' + digits.slice(-9);
  }

  function getReminderMessage(appointment) {
    var sessionTime = appointment.sessionTime || '—';
    var serviceType = appointment.serviceType || '—';
    var sessionDate = appointment.sessionDate;
    var dateStr = sessionDate && sessionDate.toDate ? sessionDate.toDate().toLocaleDateString('ar-EG') : '—';
    return 'نذكّرك بموعد جلستك في مركز التجميل.\n🕒 التاريخ: ' + dateStr + '\n🕒 الوقت: ' + sessionTime + '\n💉 الخدمة: ' + serviceType + '\n📍 نتشرف بحضورك';
  }

  function openWhatsAppManual(appointment) {
    var clientId = appointment.clientId;
    if (!clientId) {
      toast('لا يوجد عميل مرتبط بالحجز', 'warning');
      return;
    }
    firebase.firestore().collection('clients').doc(clientId).get().then(function (doc) {
      if (!doc.exists) {
        toast('بيانات العميل غير متوفرة', 'warning');
        return;
      }
      var phone = (doc.data().phone || '').trim();
      var num = toWhatsAppNumber(phone);
      if (!num) {
        toast('رقم هاتف العميل غير صالح لواتساب', 'warning');
        return;
      }
      var text = getReminderMessage(appointment);
      var url = 'https://wa.me/' + num + '?text=' + encodeURIComponent(text);
      window.open(url, '_blank');
      toast('تم فتح واتساب للإرسال اليدوي', 'info');
    }).catch(function () {
      toast('تعذر جلب رقم العميل', 'error');
    });
  }

  function sendReminder(appointmentId, appointment) {
    if (typeof firebase === 'undefined') return;
    var sendReminderWhatsApp = firebase.functions && firebase.functions().httpsCallable && firebase.functions().httpsCallable('sendReminderWhatsApp');
    if (sendReminderWhatsApp) {
      toast('جاري إرسال التذكير...', 'info');
      sendReminderWhatsApp({ appointmentId: appointmentId })
        .then(function (res) {
          var data = res.data;
          loadAppointments();
          if (data && data.ok) {
            if (data.whatsAppSent) {
              toast('تم إرسال التذكير عبر واتساب لصاحب الجلسة', 'success');
            } else {
              toast('تم حفظ التذكير. فتح واتساب للإرسال يدوياً...', 'info');
              openWhatsAppManual(appointment);
            }
          } else {
            toast(data && data.message ? data.message : 'تم حفظ التذكير', 'info');
            openWhatsAppManual(appointment);
          }
        })
        .catch(function (e) {
          loadAppointments();
          toast('ماكو Twilio أو تعذر الإرسال — افتح واتساب للإرسال يدوياً', 'info');
          openWhatsAppManual(appointment);
        });
      return;
    }
    doSendReminderLocal();
    function doSendReminderLocal() {
      var sessionTime = appointment.sessionTime || '—';
      var serviceType = appointment.serviceType || '—';
      var sessionDate = appointment.sessionDate;
      var dateStr = sessionDate && sessionDate.toDate ? sessionDate.toDate().toLocaleDateString('ar-EG') : '—';
      var body = 'نذكّرك بموعد جلستك في مركز التجميل.\n🕒 التاريخ: ' + dateStr + '\n🕒 الوقت: ' + sessionTime + '\n💉 الخدمة: ' + serviceType + '\n📍 نتشرف بحضورك';
      var clientId = appointment.clientId;
      var clientName = appointment.clientName || '—';
      var clientPhone = '';
      var clientEmail = '';
      if (clientId) {
        firebase.firestore().collection('clients').doc(clientId).get().then(function (doc) {
          if (doc.exists) {
            var c = doc.data();
            clientPhone = c.phone || '';
            clientEmail = c.email || '';
            clientName = c.name || clientName;
          }
          saveReminderOnly();
        }).catch(function () { saveReminderOnly(); });
      } else {
        saveReminderOnly();
      }
      function saveReminderOnly() {
        firebase.firestore().collection('client_reminders').add({
          appointmentId: appointmentId,
          clientId: clientId || null,
          clientName: clientName,
          clientPhone: clientPhone || null,
          clientEmail: clientEmail || null,
          subject: 'تذكير بموعد جلستك - مركز التجميل',
          body: body,
          sessionDate: appointment.sessionDate,
          sessionTime: sessionTime,
          serviceType: serviceType,
          sentAt: firebase.firestore.FieldValue.serverTimestamp(),
          sentBy: auth.currentUser ? auth.currentUser.uid : null,
          channel: 'reminder_manual',
          whatsAppSent: false
        }).then(function () {
          return firebase.firestore().collection('appointments').doc(appointmentId).update({ reminderSent: true });
        }).then(function () {
          loadAppointments();
          toast('تم حفظ التذكير (إرسال واتساب يتطلب نشر الدوال وTwilio)', 'success');
        }).catch(function (e) {
          toast('خطأ: ' + (e.message || e), 'error');
        });
      }
    }
  }

  function deductInventoryForAppointment(appointmentId) {
    firebase.firestore().collection('appointments').doc(appointmentId).get().then(function (doc) {
      if (!doc.exists) return;
      const data = doc.data();
      const serviceType = (data.serviceType || '').toLowerCase();
      if (!serviceType) return;
      firebase.firestore().collection('inventory').where('usedFor', 'array-contains', data.serviceType).get().then(function (snap) {
        const batch = firebase.firestore().batch();
        snap.docs.forEach(function (d) {
          const cur = d.data().stock || 0;
          if (cur > 0) {
            batch.update(d.ref, { stock: cur - 1 });
            firebase.firestore().collection('inventory_logs').add({
              productId: d.id,
              type: 'deduct',
              quantity: 1,
              reason: 'جلسة: ' + (data.serviceType || '') + ' - ' + appointmentId,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
        });
        batch.commit().catch(console.error);
      });
    });
  }

  function getQueryRange() {
    var start, end;
    if (currentView === 'today') {
      start = utils.getTodayStart();
      end = utils.getTodayEnd();
    } else if (currentView === 'tomorrow') {
      start = utils.getTomorrowStart();
      end = utils.getTomorrowEnd();
    } else {
      var dateVal = filterDate && filterDate.value ? filterDate.value : new Date().toISOString().slice(0, 10);
      start = new Date(dateVal);
      start.setHours(0, 0, 0, 0);
      end = new Date(dateVal);
      end.setHours(23, 59, 59, 999);
    }
    return {
      startTs: firebase.firestore.Timestamp.fromDate(start),
      endTs: firebase.firestore.Timestamp.fromDate(end)
    };
  }

  function loadAppointments() {
    if (typeof firebase === 'undefined') {
      emptyEl.classList.remove('hide');
      return;
    }
    showLoading(true);
    var statusVal = filterStatus.value;
    var serviceVal = filterService && filterService.value ? filterService.value : '';
    var searchVal = (searchClient && searchClient.value || '').trim().toLowerCase();
    var coll = firebase.firestore().collection('appointments');
    var promise;

    if (currentView === 'all') {
      var yearStart = new Date(new Date().getFullYear(), 0, 1);
      var yearEnd = new Date(new Date().getFullYear() + 1, 11, 31, 23, 59, 59);
      promise = coll
        .where('sessionDate', '>=', firebase.firestore.Timestamp.fromDate(yearStart))
        .where('sessionDate', '<=', firebase.firestore.Timestamp.fromDate(yearEnd))
        .get();
    } else {
      var range = getQueryRange();
      promise = coll
        .where('sessionDate', '>=', range.startTs)
        .where('sessionDate', '<=', range.endTs)
        .get();
    }

    promise
      .then(function (snap) {
        var items = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        items.sort(function (a, b) {
          var ta = a.sessionDate && a.sessionDate.toDate ? a.sessionDate.toDate().getTime() : 0;
          var tb = b.sessionDate && b.sessionDate.toDate ? b.sessionDate.toDate().getTime() : 0;
          return currentView === 'all' ? tb - ta : ta - tb;
        });
        if (statusVal) items = items.filter(function (a) { return a.status === statusVal; });
        if (serviceVal) items = items.filter(function (a) { return a.serviceType === serviceVal; });
        if (searchVal) items = items.filter(function (a) { return (a.clientName || '').toLowerCase().includes(searchVal); });
        renderList(items);
      })
      .catch(function (err) {
        console.error('loadAppointments', err);
        listEl.innerHTML = '';
        emptyEl.classList.remove('hide');
        toast('تعذر تحميل الحجوزات. تحقق من الاتصال أو قواعد Firestore.', 'error');
      })
      .finally(function () { showLoading(false); });
  }

  function getClientNameById(id) {
    return new Promise(function (resolve) {
      if (!id) { resolve(''); return; }
      firebase.firestore().collection('clients').doc(id).get().then(function (doc) {
        resolve(doc.exists ? (doc.data().name || '') : '');
      }).catch(function () { resolve(''); });
    });
  }

  function saveAppointment(e) {
    e.preventDefault();
    const clientId = appClient.value.trim();
    if (!clientId) { toast('اختر العميل', 'warning'); return; }
    const sessions = getSessionsFromForm();
    if (!sessions.length) {
      toast('أضف جلسة واحدة على الأقل (التاريخ والوقت مطلوبان).', 'warning');
      return;
    }
    getClientNameById(clientId).then(function (clientName) {
      const basePayload = {
        clientId: clientId,
        clientName: clientName,
        serviceType: appService.value,
        doctorId: appDoctor.value || null,
        status: appStatus.value
      };
      if (appId.value) {
        var s = sessions[0];
        basePayload.sessionDate = firebase.firestore.Timestamp.fromDate(new Date(s.date + 'T' + (s.time || '00:00')));
        basePayload.sessionTime = s.time;
        firebase.firestore().collection('appointments').doc(appId.value).update(basePayload).then(function () {
          closeModal();
          loadAppointments();
          toast('تم حفظ التعديلات', 'success');
        }).catch(function (err) { toast('خطأ: ' + (err.message || err), 'error'); });
      } else {
        const db = firebase.firestore();
        const batch = db.batch();
        sessions.forEach(function (s) {
          const ref = db.collection('appointments').doc();
          batch.set(ref, {
            clientId: basePayload.clientId,
            clientName: basePayload.clientName,
            serviceType: basePayload.serviceType,
            doctorId: basePayload.doctorId,
            status: basePayload.status,
            sessionDate: firebase.firestore.Timestamp.fromDate(new Date(s.date + 'T' + (s.time || '00:00'))),
            sessionTime: s.time,
            reminderSent: false
          });
        });
        batch.commit().then(function () {
          closeModal();
          loadAppointments();
          toast('تم إضافة ' + sessions.length + ' جلسة بنجاح', 'success');
        }).catch(function (err) { toast('خطأ: ' + (err.message || err), 'error'); });
      }
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

function setViewMode(mode) {
    currentView = mode;
    var tabs = document.querySelectorAll('.view-tab');
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-view') === mode);
    });
    var dateWrap = document.getElementById('dateFilterWrap');
    if (dateWrap) dateWrap.style.display = (mode === 'today' || mode === 'tomorrow') ? 'none' : 'inline';
    loadAppointments();
  }

  document.addEventListener('DOMContentLoaded', function () {
    auth.init().then(function () {
      if (!auth.redirectIfUnauthorized()) return;
      setDefaultDate();
      bindAuth();
      loadClients();
      loadDoctors();
      loadAppointments();
      document.querySelectorAll('.view-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setViewMode(btn.getAttribute('data-view'));
        });
      });
      btnFilter.addEventListener('click', loadAppointments);
      if (searchClient) searchClient.addEventListener('input', function () { loadAppointments(); });
      if (searchClient) searchClient.addEventListener('keyup', function (e) { if (e.key === 'Enter') loadAppointments(); });
      btnAdd.addEventListener('click', function () { openModal(null); });
      form.addEventListener('submit', saveAppointment);
      btnCancelModal.addEventListener('click', closeModal);
      modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.options-dropdown')) {
          listEl.querySelectorAll('.options-dropdown.open').forEach(function (d) {
            d.classList.remove('open');
            var t = d.querySelector('.options-trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
        }
      });
    });
  });
})();
