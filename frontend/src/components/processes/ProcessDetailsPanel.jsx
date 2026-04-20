import {
  CheckCircle2,
  Cog,
  GitBranch,
  ListTree,
  ScrollText,
  Workflow,
} from "lucide-react";

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

function ProcessDetailsPanel({ item }) {
  if (!item) {
    return (
      <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
        <div className="flex min-h-[420px] items-center justify-center text-center">
          <div className="max-w-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center text-cyan-100">
              <Workflow className="h-8 w-8" />
            </div>
            <h2 className="mt-6 font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">
              Процесс не найден
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              По текущему поиску нет подходящих процессов. Измените строку поиска, чтобы
              снова увидеть детали выбранного процесса.
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
            <Workflow className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Карточка процесса</div>
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
                {item.relatedRoutes.length}
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-cyan-100/60">
                Маршрутов
              </div>
            </div>
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
          <StatusTile label="Активность" value={item.isActive ? "Активен" : "Неактивен"} />
          <StatusTile
            label="Использование в маршрутах"
            value={item.relatedRoutes.length > 0 ? `${item.relatedRoutes.length} маршрут(а)` : "Пока не используется"}
            tone={item.relatedRoutes.length > 0 ? "cyan" : "amber"}
          />
          <StatusTile
            label="Использование в шагах"
            value={item.stepUsages.length > 0 ? `${item.stepUsages.length} шаг(а)` : "Шагов пока нет"}
            tone={item.stepUsages.length > 0 ? "cyan" : "amber"}
          />
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <GitBranch className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Связанные маршруты</div>
        </div>

        <div className="space-y-3">
          {item.relatedRoutes.length > 0 ? (
            item.relatedRoutes.map((route) => (
              <div
                key={`${item.id}-${route.code}`}
                className="rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))] px-4 py-4"
              >
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Маршрут
                </div>
                <div className="mt-2 text-base font-semibold text-slate-50">
                  {route.code} {route.name}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-none border border-cyan-300/8 bg-[linear-gradient(180deg,rgba(18,31,43,0.72),rgba(10,19,29,0.76))] px-4 py-4 text-sm leading-6 text-slate-400">
              Процесс пока не привязан к активным маршрутам demo-слоя.
            </div>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <ListTree className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Использование в шагах</div>
        </div>

        <div className="space-y-3">
          {item.stepUsages.length > 0 ? (
            item.stepUsages.map((step) => (
              <div
                key={`${item.id}-${step.routeCode}-${step.stepNo}`}
                className="rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))] px-4 py-4"
              >
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Шаг {step.stepNo}
                </div>
                <div className="mt-2 text-base font-semibold text-slate-50">{step.stepName}</div>
                <div className="mt-2 text-sm text-slate-400">
                  {step.routeCode} {step.routeName}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-none border border-cyan-300/8 bg-[linear-gradient(180deg,rgba(18,31,43,0.72),rgba(10,19,29,0.76))] px-4 py-4 text-sm leading-6 text-slate-400">
              В текущих demo-данных процесс ещё не встречается в шагах маршрутов.
            </div>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <Cog className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Оборудование</div>
        </div>

        <div className="space-y-3">
          {item.equipment.map((machine) => (
            <div
              key={`${item.id}-${machine}`}
              className="rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))] px-4 py-4"
            >
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Оборудование</div>
              <div className="mt-2 text-base font-semibold text-slate-50">{machine}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 rounded-none border border-cyan-300/8 bg-[linear-gradient(180deg,rgba(18,31,43,0.72),rgba(10,19,29,0.76))] px-4 py-4">
        <div className="flex items-start gap-3">
          <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
          <p className="text-sm leading-6 text-slate-300">
            Процессы в V2 выступают как повторно используемые технологические операции и
            связывают маршруты, шаги и доступное оборудование в одном производственном слое.
          </p>
        </div>
      </div>
    </aside>
  );
}

export default ProcessDetailsPanel;
