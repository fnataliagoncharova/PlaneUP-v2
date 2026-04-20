import { CheckCircle2, Cog, Gauge } from "lucide-react";

function MachineDetailsPanel({ item }) {
  if (!item) {
    return (
      <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
        <div className="flex min-h-[420px] items-center justify-center text-center">
          <div className="max-w-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center text-cyan-100">
              <Cog className="h-8 w-8" />
            </div>
            <h2 className="mt-6 font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">
              Оборудование не найдено
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              По текущему поиску нет подходящих единиц оборудования. Измените строку поиска,
              чтобы снова увидеть детали выбранной единицы.
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
          <div className="panel-title">Выбранная единица</div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            {item.name}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">{item.description}</p>
        </div>
        <span className="rounded-none border border-cyan-200/24 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">
          {item.code}
        </span>
      </div>

      <div className="panel-divider mt-5" />

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <Cog className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Карточка оборудования</div>
        </div>

        <div className="rounded-none border border-cyan-100/56 bg-[linear-gradient(180deg,rgba(32,174,207,0.34),rgba(16,78,107,0.82))] px-5 py-5 shadow-[0_0_0_1px_rgba(125,246,255,0.2),inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_rgba(34,211,238,0.28)]">
          <div className="flex min-h-[110px] items-start justify-between gap-5">
            <div className="max-w-[72%]">
              <div className="text-sm uppercase tracking-[0.22em] text-cyan-100/72">
                {item.code}
              </div>
              <div className="mt-3 text-[1.36rem] font-semibold leading-tight text-cyan-50">
                {item.name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-semibold leading-none text-cyan-50">
                {item.stepUsages.length}
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-cyan-100/60">
                Шагов
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-4 border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="text-lg font-medium text-slate-50">Статус</div>
          </div>
          <span
            className={[
              "inline-flex rounded-none border px-3 py-1 text-[11px] uppercase tracking-[0.18em]",
              item.isActive
                ? "border-cyan-200/18 bg-cyan-300/10 text-cyan-100/80"
                : "border-amber-200/18 bg-amber-300/10 text-amber-100/80",
            ].join(" ")}
          >
            {item.isActive ? "Активно" : "Неактивно"}
          </span>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <Gauge className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Использование и производительность</div>
        </div>

        <div className="overflow-hidden rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))]">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-white/[0.03] text-left">
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Маршрут
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Шаг
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Операция
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Роль
                  </th>
                  <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                    Производительность
                  </th>
                </tr>
              </thead>
              <tbody>
                {item.usageEntries.map((entry) => {
                  const isPrimary = entry.role === "Primary";

                  return (
                    <tr
                      key={`${item.id}-${entry.routeCode}-${entry.stepNo}-${entry.role}`}
                      className="border-t border-white/[0.06] transition-colors hover:bg-cyan-300/[0.05]"
                    >
                      <td className="px-4 py-3 align-top text-sm text-slate-200">
                        <div className="font-medium text-slate-100">{entry.routeCode}</div>
                        <div className="mt-1 text-xs text-slate-500">{entry.routeName}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-200">
                        <div className="font-medium text-slate-100">Шаг {entry.stepNo}</div>
                        <div className="mt-1 text-xs text-slate-500">{entry.stepName}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-200">
                        {entry.operation}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={[
                            "inline-flex rounded-none border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                            isPrimary
                              ? "border-cyan-200/20 bg-cyan-300/10 text-cyan-100/80"
                              : "border-amber-200/20 bg-amber-300/10 text-amber-100/80",
                          ].join(" ")}
                        >
                          {entry.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-sm font-medium text-slate-100">
                        {entry.rate}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </aside>
  );
}

export default MachineDetailsPanel;
