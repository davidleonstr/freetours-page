// Lightweight promise-based replacement for window.confirm(), wired to the
// markup rendered by src/components/ConfirmDialog.astro (one instance per
// page). Call initConfirmDialog() once after that markup is on the page,
// then use confirmDialog({...}) anywhere window.confirm() used to be
// called — `if (!(await confirmDialog({...}))) return;`.

let overlay, titleEl, messageEl, cancelBtn, okBtn;
let resolveCurrent = null;

export function initConfirmDialog() {
  overlay = document.getElementById("confirm-overlay");
  titleEl = document.getElementById("confirm-title");
  messageEl = document.getElementById("confirm-message");
  cancelBtn = document.getElementById("confirm-cancel");
  okBtn = document.getElementById("confirm-ok");

  if (!overlay || !titleEl || !messageEl || !cancelBtn || !okBtn) {
    console.warn("ConfirmDialog markup not found on this page — add <ConfirmDialog /> to it.");
    overlay = undefined;
    return;
  }

  cancelBtn.addEventListener("click", () => close(false));
  okBtn.addEventListener("click", () => close(true));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay && !overlay.classList.contains("cd-is-hidden")) close(false);
  });
}

function close(result) {
  overlay.classList.add("cd-is-hidden");
  const resolve = resolveCurrent;
  resolveCurrent = null;
  resolve?.(result);
}

export function confirmDialog({
  title = "¿Estás seguro?",
  message = "",
  confirmLabel = "Eliminar",
  danger = true
} = {}) {
  if (!overlay) {
    // Fallback so a missing <ConfirmDialog /> doesn't silently no-op.
    return Promise.resolve(window.confirm(message || title));
  }

  titleEl.textContent = title;
  messageEl.textContent = message;
  okBtn.textContent = confirmLabel;
  okBtn.classList.toggle("cd-btn--danger", danger);
  okBtn.classList.toggle("cd-btn--safe", !danger);
  overlay.classList.remove("cd-is-hidden");
  okBtn.focus();

  return new Promise((resolve) => {
    resolveCurrent = resolve;
  });
}