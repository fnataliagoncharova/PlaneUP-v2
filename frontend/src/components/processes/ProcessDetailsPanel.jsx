import { CheckCircle2, Hash, PencilLine, Workflow } from "lucide-react";

function StatusTile({ label, value, tone = "cyan" }) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200/20 bg-[linear-gradient(180deg,rgba(97,64,23,0.26),rgba(41,28,17,0.62))]"
      : "border-cyan-200/18 bg-[linear-gradient(180deg,rgba(20,95,118,0.22),rgba(10,34,49,0.62))]";

  return (
    <div className={`border px-4 py-4 ${toneClass}`}>
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 text-base font-medium text-slate-50">{value}</div>
    </div>
  );
}

function ProcessDetailsPanel({ item, onEdit }) {
  if (!item) {
    return (
      <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
        <div className="flex min-h-[420px] items-center justify-center text-center">
          <div className="max-w-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center text-cyan-100">
              <Workflow className="h-8 w-8" />
            </div>
            <h2 className="mt-6 font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">
              Операция не выбрана
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Выберите операцию в списке слева, чтобы посмотреть карточку и статус.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="panel-title">Выбранная операция</div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            {item.process_name}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Карточка технологической операции из V2-справочника. Данные синхронизированы с
            backend API.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]"
          >
            <PencilLine className="h-3.5 w-3.5" />
            Редактировать
          </button>
          <span className="rounded-none border border-cyan-200/24 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">
            {item.process_code}
          </span>
        </div>
      </div>

      <div className="panel-divider mt-5" />

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <Workflow className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Карточка операции</div>
        </div>

        <div className="rounded-none border border-cyan-100/56 bg-[linear-gradient(180deg,rgba(32,174,207,0.34),rgba(16,78,107,0.82))] px-5 py-5 shadow-[0_0_0_1px_rgba(125,246,255,0.2),inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_rgba(34,211,238,0.28)]">
          <div className="text-sm uppercase tracking-[0.22em] text-cyan-100/72">
            {item.process_code}
          </div>
          <div className="mt-3 text-[1.36rem] font-semibold leading-tight text-cyan-50">
            {item.process_name}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Статус</div>
        </div>

        <div className="grid gap-3">
          <StatusTile
            label="Активность"
            value={item.is_active ? "Активна" : "Неактивна"}
            tone={item.is_active ? "cyan" : "amber"}
          />
        </div>
      </section>

      <section className="mt-6">
        <div className="border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))] px-4 py-4">
          <div className="flex items-center gap-3">
            <Hash className="h-4 w-4 text-cyan-200" />
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Код</div>
          </div>
          <div className="mt-3 text-sm font-medium text-slate-100">{item.process_code}</div>
        </div>
      </section>
    </aside>
  );
}

export default ProcessDetailsPanel;
