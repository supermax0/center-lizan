/**
 * إشعارات Toast وحوار التأكيد
 */
(function () {
  'use strict';

  function createContainer(id, className) {
    var el = document.getElementById(id);
    if (el) return el;
    el = document.createElement('div');
    el.id = id;
    el.className = className;
    document.body.appendChild(el);
    return el;
  }

  function toast(message, type) {
    type = type || 'info';
    var container = createContainer('toast-container', 'toast-container');
    var t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.setAttribute('role', 'alert');
    t.textContent = message;
    container.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 300);
    }, 2800);
  }

  function confirmDialog(message, onConfirm, onCancel) {
    var overlay = createContainer('confirm-overlay', 'overlay confirm-overlay');
    overlay.innerHTML =
      '<div class="modal confirm-modal">' +
        '<p class="confirm-message"></p>' +
        '<div class="flex gap-1 justify-between mt-2">' +
          '<button type="button" class="btn btn-outline" data-action="cancel">إلغاء</button>' +
          '<button type="button" class="btn btn-primary" data-action="confirm">تأكيد</button>' +
        '</div>' +
      '</div>';
    overlay.querySelector('.confirm-message').textContent = message;
    overlay.classList.add('show');
    function close(result) {
      overlay.classList.remove('show');
      if (result && typeof onConfirm === 'function') onConfirm();
      if (!result && typeof onCancel === 'function') onCancel();
    }
    overlay.querySelector('[data-action="confirm"]').addEventListener('click', function () { close(true); });
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', function () { close(false); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });
  }

  window.toast = toast;
  window.confirmDialog = confirmDialog;
})();
