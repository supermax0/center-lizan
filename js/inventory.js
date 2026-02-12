/**
 * إدارة المخزون - منتجات، كمية، صلاحية، حد التنبيه، خصم تلقائي بعد الجلسة
 */
(function () {
  'use strict';

  const tbody = document.getElementById('inventoryBody');
  const emptyEl = document.getElementById('inventoryEmpty');
  const loadingEl = document.getElementById('inventoryLoading');
  const lowStockAlert = document.getElementById('lowStockAlert');
  const searchInput = document.getElementById('searchInventory');
  const btnAdd = document.getElementById('btnAddProduct');
  const modal = document.getElementById('modalProduct');
  const form = document.getElementById('formProduct');
  const modalTitle = document.getElementById('modalProductTitle');
  const productIdInput = document.getElementById('productId');
  const productNameInput = document.getElementById('productName');
  const productStockInput = document.getElementById('productStock');
  const productMinStockInput = document.getElementById('productMinStock');
  const productExpiryInput = document.getElementById('productExpiry');
  const productUsedForInput = document.getElementById('productUsedFor');
  const btnCancelModal = document.getElementById('btnCancelProductModal');

  function showLoading(show) {
    loadingEl.classList.toggle('hide', !show);
    tbody.style.opacity = show ? '0.5' : '1';
  }

  function formatExpiry(ts) {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const s = d.toLocaleDateString('ar-EG');
    const now = new Date();
    if (d < now) return '<span class="text-danger">منتهي ' + s + '</span>';
    const daysLeft = Math.ceil((d - now) / (24 * 60 * 60 * 1000));
    if (daysLeft <= 30) return '<span class="text-warning">قريب الانتهاء ' + s + ' (' + daysLeft + ' يوم)</span>';
    return s;
  }

  function openModal(editData) {
    productIdInput.value = editData ? editData.id : '';
    modalTitle.textContent = editData ? 'تعديل المنتج' : 'منتج جديد';
    if (editData) {
      productNameInput.value = editData.name || '';
      productStockInput.value = editData.stock ?? 0;
      productMinStockInput.value = editData.minStock ?? 5;
      productExpiryInput.value = editData.expiryDate ? (editData.expiryDate.toDate ? editData.expiryDate.toDate().toISOString().slice(0, 10) : editData.expiryDate) : '';
      productUsedForInput.value = Array.isArray(editData.usedFor) ? (editData.usedFor[0] || '') : (editData.usedFor || '');
    } else {
      form.reset();
      productIdInput.value = '';
      productMinStockInput.value = 5;
    }
    modal.classList.add('show');
  }

  function closeModal() {
    modal.classList.remove('show');
  }

  function loadInventory() {
    if (typeof firebase === 'undefined') {
      emptyEl.classList.remove('hide');
      return;
    }
    showLoading(true);
    firebase.firestore().collection('inventory').get().then(function (snap) {
      let items = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      const q = (searchInput.value || '').trim().toLowerCase();
      if (q) {
        items = items.filter(function (p) { return (p.name || '').toLowerCase().includes(q); });
      }
      const lowItems = items.filter(function (p) {
        const min = p.minStock != null ? p.minStock : 5;
        return (p.stock || 0) <= min;
      });
      if (lowItems.length) {
        lowStockAlert.textContent = 'تنبيه: ' + lowItems.length + ' منتج بكمية منخفضة.';
        lowStockAlert.classList.remove('hide');
      } else {
        lowStockAlert.classList.add('hide');
      }
      if (!items.length) {
        tbody.innerHTML = '';
        emptyEl.classList.remove('hide');
      } else {
        emptyEl.classList.add('hide');
        tbody.innerHTML = items.map(function (p) {
          const min = p.minStock != null ? p.minStock : 5;
          const isLow = (p.stock || 0) <= min;
          const expiryStr = formatExpiry(p.expiryDate);
          return '<tr>' +
            '<td>' + (p.name || '—') + '</td>' +
            '<td>' + (isLow ? '<strong class="text-danger">' + (p.stock || 0) + '</strong>' : (p.stock || 0)) + '</td>' +
            '<td>' + min + '</td>' +
            '<td>' + expiryStr + '</td>' +
            '<td>' + (Array.isArray(p.usedFor) ? (p.usedFor[0] || '—') : (p.usedFor || '—')) + '</td>' +
            '<td><div class="options-dropdown" data-id="' + p.id + '">' +
              '<button type="button" class="options-trigger" aria-expanded="false">خيارات ▾</button>' +
              '<div class="options-menu" role="menu">' +
                '<button type="button" role="menuitem" data-action="edit" data-id="' + p.id + '">تعديل</button>' +
                '<button type="button" role="menuitem" data-action="delete" data-id="' + p.id + '">حذف</button>' +
              '</div></div></td>' +
          '</tr>';
        }).join('');
        tbody.querySelectorAll('.options-dropdown').forEach(function (dropdown) {
          const trigger = dropdown.querySelector('.options-trigger');
          const menu = dropdown.querySelector('.options-menu');
          const id = dropdown.getAttribute('data-id');
          const product = items.find(function (x) { return x.id === id; });

          trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            const isOpen = dropdown.classList.toggle('open');
            trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            tbody.querySelectorAll('.options-dropdown').forEach(function (d) {
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
              if (action === 'edit') openModal(product);
              else if (action === 'delete') confirmDialog('حذف هذا المنتج نهائياً؟', function () { deleteProduct(id); });
            });
          });
        });
      }
    }).catch(function (err) {
      console.error(err);
      tbody.innerHTML = '';
      emptyEl.classList.remove('hide');
    }).finally(function () { showLoading(false); });
  }

  function saveProduct(e) {
    e.preventDefault();
    const name = productNameInput.value.trim();
    const stock = parseInt(productStockInput.value, 10);
    const minStock = parseInt(productMinStockInput.value, 10) || 5;
    const expiryVal = productExpiryInput.value;
    const usedFor = (productUsedForInput.value || '').trim() || null;
    if (!name || isNaN(stock) || stock < 0) { toast('الاسم والكمية مطلوبان', 'warning'); return; }
    const payload = {
      name: name,
      stock: stock,
      minStock: minStock,
      usedFor: usedFor ? [usedFor] : [],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (expiryVal) {
      payload.expiryDate = firebase.firestore.Timestamp.fromDate(new Date(expiryVal));
    }
    if (productIdInput.value) {
      firebase.firestore().collection('inventory').doc(productIdInput.value).update(payload).then(function () {
        closeModal();
        loadInventory();
        toast('تم حفظ التعديلات', 'success');
      }).catch(function (err) { toast('خطأ: ' + (err.message || err), 'error'); });
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      firebase.firestore().collection('inventory').add(payload).then(function () {
        closeModal();
        loadInventory();
        toast('تم إضافة المنتج', 'success');
      }).catch(function (err) { toast('خطأ: ' + (err.message || err), 'error'); });
    }
  }

  function deleteProduct(productId) {
    if (typeof firebase === 'undefined') return;
    firebase.firestore().collection('inventory').doc(productId).delete()
      .then(function () {
        loadInventory();
        toast('تم حذف المنتج', 'success');
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
      loadInventory();
      btnAdd.addEventListener('click', function () { openModal(null); });
      form.addEventListener('submit', saveProduct);
      btnCancelModal.addEventListener('click', closeModal);
      modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
      searchInput.addEventListener('input', loadInventory);
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.options-dropdown')) {
          if (tbody) tbody.querySelectorAll('.options-dropdown.open').forEach(function (d) {
            d.classList.remove('open');
            const t = d.querySelector('.options-trigger');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
        }
      });
    });
  });
})();
