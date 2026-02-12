/**
 * إدارة العملاء - ملف العميل، ملاحظات طبية، سجل الجلسات
 */
(function () {
  'use strict';

  const listEl = document.getElementById('clientsList');
  const emptyEl = document.getElementById('clientsEmpty');
  const loadingEl = document.getElementById('clientsLoading');
  const searchInput = document.getElementById('searchClient');
  const btnAdd = document.getElementById('btnAddClient');
  const modal = document.getElementById('modalClient');
  const form = document.getElementById('formClient');
  const modalTitle = document.getElementById('modalClientTitle');
  const clientIdInput = document.getElementById('clientId');
  const clientNameInput = document.getElementById('clientName');
  const clientPhoneInput = document.getElementById('clientPhone');
  const clientNotesInput = document.getElementById('clientNotes');
  const btnCancelModal = document.getElementById('btnCancelClientModal');
  const modalView = document.getElementById('modalClientView');
  const viewName = document.getElementById('viewClientName');
  const viewPhone = document.getElementById('viewClientPhone');
  const viewNotes = document.getElementById('viewClientNotes');
  const viewSessions = document.getElementById('viewClientSessions');
  const viewSessionsEmpty = document.getElementById('viewClientSessionsEmpty');
  const btnCloseView = document.getElementById('btnCloseView');

  function showLoading(show) {
    loadingEl.classList.toggle('hide', !show);
    listEl.style.opacity = show ? '0.5' : '1';
  }

  function openModal(editData) {
    clientIdInput.value = editData ? editData.id : '';
    modalTitle.textContent = editData ? 'تعديل العميل' : 'عميل جديد';
    if (editData) {
      clientNameInput.value = editData.name || '';
      clientPhoneInput.value = editData.phone || '';
      clientNotesInput.value = editData.medicalNotes || '';
    } else {
      form.reset();
      clientIdInput.value = '';
    }
    modal.classList.add('show');
  }

  function closeModal() {
    modal.classList.remove('show');
  }

  function openView(client) {
    viewName.textContent = client.name || '—';
    viewPhone.textContent = client.phone || '—';
    viewNotes.textContent = client.medicalNotes || '—';
    viewSessions.innerHTML = '';
    viewSessionsEmpty.classList.add('hide');
    modalView.classList.add('show');
    if (typeof firebase === 'undefined') return;
    firebase.firestore().collection('appointments')
      .where('clientId', '==', client.id)
      .get()
      .then(function (snap) {
        if (snap.empty) {
          viewSessionsEmpty.classList.remove('hide');
          return;
        }
        const docs = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        docs.sort(function (a, b) {
          const da = a.sessionDate && a.sessionDate.toDate ? a.sessionDate.toDate().getTime() : 0;
          const db = b.sessionDate && b.sessionDate.toDate ? b.sessionDate.toDate().getTime() : 0;
          return db - da;
        });
        const limited = docs.slice(0, 20);
        viewSessions.innerHTML = limited.map(function (x) {
          const dateStr = x.sessionDate ? (x.sessionDate.toDate ? x.sessionDate.toDate().toLocaleDateString('ar-EG') : x.sessionDate) : '—';
          const status = utils.STATUS_LABELS[x.status] || x.status;
          return '<div class="list-item"><div class="info"><div class="name">' + (x.serviceType || '—') + '</div><div class="meta">' + dateStr + ' · ' + (x.sessionTime || '') + ' · ' + status + '</div></div></div>';
        }).join('');
      })
      .catch(function () { viewSessionsEmpty.classList.remove('hide'); });
  }

  function loadClients() {
    if (typeof firebase === 'undefined') {
      emptyEl.classList.remove('hide');
      return;
    }
    showLoading(true);
    Promise.all([
      firebase.firestore().collection('clients').orderBy('name').get(),
      firebase.firestore().collection('appointments').get()
    ]).then(function ([clientsSnap, appointmentsSnap]) {
      const countByClient = {};
      appointmentsSnap.docs.forEach(function (d) {
        const cid = d.data().clientId;
        if (cid) countByClient[cid] = (countByClient[cid] || 0) + 1;
      });
      let items = clientsSnap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      const q = (searchInput.value || '').trim().toLowerCase();
      if (q) {
        items = items.filter(function (c) {
          return (c.name || '').toLowerCase().includes(q) || (c.phone || '').replace(/\s/g, '').includes(q.replace(/\s/g, ''));
        });
      }
      if (!items.length) {
        listEl.innerHTML = '';
        emptyEl.classList.remove('hide');
      } else {
        emptyEl.classList.add('hide');
        listEl.innerHTML = items.map(function (c) {
          const sessionCount = countByClient[c.id] || 0;
          const meta = (c.phone || '—') + ' · ' + sessionCount + ' جلسة' + (c.medicalNotes ? ' · ' + (c.medicalNotes.slice(0, 25)) + (c.medicalNotes.length > 25 ? '...' : '') : '');
          return '<div class="list-item">' +
            '<div class="info">' +
              '<div class="name">' + (c.name || '—') + '</div>' +
              '<div class="meta">' + meta + '</div>' +
            '</div>' +
            '<div class="actions">' +
              '<div class="options-dropdown" data-id="' + c.id + '">' +
                '<button type="button" class="options-trigger" aria-expanded="false">خيارات ▾</button>' +
                '<div class="options-menu" role="menu">' +
                  '<button type="button" role="menuitem" data-action="view" data-id="' + c.id + '">عرض</button>' +
                  '<button type="button" role="menuitem" data-action="edit" data-id="' + c.id + '">تعديل</button>' +
                  '<button type="button" role="menuitem" data-action="delete" data-id="' + c.id + '">حذف</button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('');
        listEl.querySelectorAll('.options-dropdown').forEach(function (dropdown) {
          const trigger = dropdown.querySelector('.options-trigger');
          const menu = dropdown.querySelector('.options-menu');
          const id = dropdown.getAttribute('data-id');
          const client = items.find(function (x) { return x.id === id; });

          trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            const isOpen = dropdown.classList.toggle('open');
            trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            listEl.querySelectorAll('.options-dropdown').forEach(function (d) {
              if (d !== dropdown) {
                d.classList.remove('open');
                const t = d.querySelector('.options-trigger');
                if (t) t.setAttribute('aria-expanded', 'false');
              }
            });
          });

          menu.querySelectorAll('[data-action]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
              e.stopPropagation();
              const action = btn.getAttribute('data-action');
              dropdown.classList.remove('open');
              trigger.setAttribute('aria-expanded', 'false');
              if (action === 'view') openView(client);
              else if (action === 'edit') openModal(client);
              else if (action === 'delete') confirmDialog('حذف هذا العميل نهائياً؟', function () { deleteClient(id); });
            });
          });
        });
      }
    }).catch(function (err) {
      console.error(err);
      listEl.innerHTML = '';
      emptyEl.classList.remove('hide');
    }).finally(function () { showLoading(false); });
  }

  function saveClient(e) {
    e.preventDefault();
    const name = clientNameInput.value.trim();
    const phone = clientPhoneInput.value.trim();
    if (!name || !phone) { toast('الاسم والهاتف مطلوبان', 'warning'); return; }
    const payload = {
      name: name,
      phone: phone,
      medicalNotes: (clientNotesInput.value || '').trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (clientIdInput.value) {
      firebase.firestore().collection('clients').doc(clientIdInput.value).update(payload).then(function () {
        closeModal();
        loadClients();
        toast('تم حفظ التعديلات', 'success');
      }).catch(function (err) { toast('خطأ: ' + (err.message || err), 'error'); });
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      firebase.firestore().collection('clients').add(payload).then(function () {
        closeModal();
        loadClients();
        toast('تم إضافة العميل', 'success');
      }).catch(function (err) { toast('خطأ: ' + (err.message || err), 'error'); });
    }
  }

  function deleteClient(clientId) {
    if (typeof firebase === 'undefined') return;
    firebase.firestore().collection('clients').doc(clientId).delete()
      .then(function () {
        loadClients();
        toast('تم حذف العميل', 'success');
      })
      .catch(function (e) {
        toast('خطأ: ' + (e.message || e), 'error');
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
      loadClients();
      btnAdd.addEventListener('click', function () { openModal(null); });
      form.addEventListener('submit', saveClient);
      btnCancelModal.addEventListener('click', closeModal);
      modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
      searchInput.addEventListener('input', function () { loadClients(); });
      searchInput.addEventListener('keyup', function (e) { if (e.key === 'Enter') loadClients(); });
      btnCloseView.addEventListener('click', function () { modalView.classList.remove('show'); });
      modalView.addEventListener('click', function (e) { if (e.target === modalView) modalView.classList.remove('show'); });
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.options-dropdown')) {
          if (listEl) listEl.querySelectorAll('.options-dropdown.open').forEach(function (d) {
            d.classList.remove('open');
            const t = d.querySelector('.options-trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
        }
      });
    });
  });
})();
