/**
 * ConfirmDialog.js — Reusable confirmation dialog (Section 7.7)
 * Uses the native <dialog> element (#confirm-dialog in index.html).
 */

const dialog   = () => document.getElementById('confirm-dialog');
const titleEl  = () => document.getElementById('confirm-title');
const bodyEl   = () => document.getElementById('confirm-body');
const okBtn    = () => document.getElementById('confirm-ok-btn');
const cancelBtn= () => document.getElementById('confirm-cancel-btn');
const closeBtn = () => document.getElementById('confirm-close-btn');

let _resolve = null;

/**
 * Show a confirmation dialog and wait for user action.
 *
 * @param {object} opts
 * @param {string}  opts.title        - Dialog title
 * @param {string}  opts.message      - Body message (plain text or HTML)
 * @param {string}  [opts.confirmText='Confirm'] - OK button label
 * @param {string}  [opts.cancelText='Cancel']
 * @param {boolean} [opts.dangerous=false] - Makes confirm button red
 * @returns {Promise<boolean>}  - true if confirmed, false if cancelled
 */
export function confirm(opts = {}) {
  const {
    title       = 'Are you sure?',
    message     = '',
    confirmText = 'Confirm',
    cancelText  = 'Cancel',
    dangerous   = false,
  } = opts;

  const d   = dialog();
  const ok  = okBtn();
  const can = cancelBtn();
  const cls = closeBtn();

  titleEl().textContent = title;
  bodyEl().innerHTML    = message; // Allow basic HTML for emphasis

  ok.textContent  = confirmText;
  can.textContent = cancelText;
  ok.className    = dangerous ? 'btn btn-danger' : 'btn btn-primary';

  // Cleanup old listeners
  const newOk  = ok.cloneNode(true);
  const newCan = can.cloneNode(true);
  const newCls = cls.cloneNode(true);
  ok.replaceWith(newOk);
  can.replaceWith(newCan);
  cls.replaceWith(newCls);

  return new Promise((resolve) => {
    _resolve = resolve;

    const finish = (val) => {
      d.close();
      resolve(val);
    };

    okBtn().addEventListener('click',    () => finish(true));
    cancelBtn().addEventListener('click', () => finish(false));
    closeBtn().addEventListener('click',  () => finish(false));
    d.addEventListener('cancel', () => finish(false), { once: true });

    d.showModal();
  });
}
