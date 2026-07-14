/**
 * Toast.js — Global toast notification system (Section 7.11)
 * Queues toasts, auto-dismisses, pauses on hover.
 */

const CONTAINER_ID   = 'toast-container';
const AUTO_DISMISS_MS = 4000;

let container = null;

function getContainer() {
  if (!container) container = document.getElementById(CONTAINER_ID);
  return container;
}

/**
 * Show a toast notification.
 *
 * @param {object} opts
 * @param {'success'|'error'|'warning'|'info'} [opts.type='info']
 * @param {string}  opts.title
 * @param {string}  [opts.message]
 * @param {number}  [opts.duration=4000]  - Auto-dismiss delay (ms); 0 = no auto-dismiss
 */
export function showToast({ type = 'info', title, message, duration = AUTO_DISMISS_MS }) {
  const c = getContainer();
  if (!c) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  const iconSvg = getIcon(type);

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Dismiss notification">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
    ${duration > 0 ? `<div class="toast-progress" style="animation-duration:${duration}ms"></div>` : ''}
  `;

  c.appendChild(toast);

  // Manual close
  toast.querySelector('.toast-close').addEventListener('click', () => dismiss(toast));

  // Pause on hover
  let timerId = null;

  const startTimer = () => {
    if (duration <= 0) return;
    timerId = setTimeout(() => dismiss(toast), duration);
  };

  const pauseTimer = () => {
    clearTimeout(timerId);
    const progress = toast.querySelector('.toast-progress');
    if (progress) progress.style.animationPlayState = 'paused';
  };

  const resumeTimer = () => {
    const progress = toast.querySelector('.toast-progress');
    if (progress) progress.style.animationPlayState = 'running';
    // Restart from current point — simplified: just restart full timer
    timerId = setTimeout(() => dismiss(toast), duration * 0.5);
  };

  toast.addEventListener('mouseenter', pauseTimer);
  toast.addEventListener('mouseleave', resumeTimer);

  startTimer();
  return toast;
}

function dismiss(toast) {
  if (!toast.isConnected) return;
  toast.classList.add('dismissing');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  // Fallback removal
  setTimeout(() => toast.isConnected && toast.remove(), 400);
}

function getIcon(type) {
  const icons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  };
  return icons[type] || icons.info;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Convenience wrappers
export const toast = {
  success: (title, message, duration) => showToast({ type: 'success', title, message, duration }),
  error:   (title, message, duration) => showToast({ type: 'error',   title, message, duration }),
  warning: (title, message, duration) => showToast({ type: 'warning', title, message, duration }),
  info:    (title, message, duration) => showToast({ type: 'info',    title, message, duration }),
};
