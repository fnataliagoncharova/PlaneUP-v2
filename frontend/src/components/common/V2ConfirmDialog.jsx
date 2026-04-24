function V2ConfirmDialog({
  open = false,
  isOpen,
  title,
  message,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  onConfirm,
  onCancel,
  isConfirmDisabled = false,
  isCancelDisabled = false,
}) {
  const resolvedOpen = typeof isOpen === "boolean" ? isOpen : open;

  if (!resolvedOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="glass-panel w-full max-w-md p-5 sm:p-6"
      >
        <div className="panel-title">Подтверждение</div>
        <h3 className="mt-3 font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">
          {title}
        </h3>
        {message ? <p className="mt-3 text-sm leading-6 text-slate-300">{message}</p> : null}

        <div className="panel-divider mt-5" />

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCancelDisabled}
            className="inline-flex items-center rounded-none border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            className="inline-flex items-center rounded-none border border-rose-300/35 bg-rose-500/[0.15] px-3.5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-500/[0.22] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default V2ConfirmDialog;
