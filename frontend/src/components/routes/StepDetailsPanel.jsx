import { ArrowRightLeft, Boxes, Cog, Gauge, PackageCheck } from "lucide-react";

function StepDetailsPanel({ route, step }) {
  return (
    <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="panel-title">Выбранный шаг</div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            Шаг {step.number}: {step.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">{step.process}</p>
        </div>
        <span className="rounded-none border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-100">
          {route.code}
        </span>
      </div>

      <div className="panel-divider mt-5" />

      <p className="mt-5 rounded-none border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-300">
        {step.note}
      </p>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <PackageCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-medium text-slate-50">Результат</div>
          </div>
        </div>

        <div className="rounded-none border border-cyan-100/56 bg-[linear-gradient(180deg,rgba(32,174,207,0.4),rgba(16,78,107,0.86))] px-5 py-5 shadow-[0_0_0_1px_rgba(125,246,255,0.22),inset_0_1px_0_rgba(255,255,255,0.08),0_0_48px_rgba(34,211,238,0.34)]">
          <div className="flex min-h-[96px] items-start justify-between gap-5">
            <div className="max-w-[70%]">
              <div className="text-[1.32rem] font-semibold leading-tight text-cyan-50">
                {step.output.name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-semibold leading-none text-cyan-50">
                {step.output.qty}
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-cyan-100/60">
                {step.output.unit}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <ArrowRightLeft className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-medium text-slate-50">Входы</div>
          </div>
        </div>

        <div className="space-y-3">
          {step.inputs.map((input) => {
            const isExternal = input.type === "external";

            return (
              <div
                key={`${step.id}-${input.name}`}
                className={[
                  "rounded-none border px-4 py-4",
                  isExternal
                    ? "border-amber-200/28 bg-[linear-gradient(180deg,rgba(112,73,27,0.28),rgba(48,31,17,0.66))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "border-cyan-200/20 bg-[linear-gradient(180deg,rgba(25,88,114,0.28),rgba(11,30,44,0.62))] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-medium text-slate-50">{input.name}</div>
                    <div
                      className={[
                        "mt-2 text-xs uppercase tracking-[0.18em]",
                        isExternal ? "text-amber-100/72" : "text-cyan-100/62",
                      ].join(" ")}
                    >
                      {isExternal ? "Внешний вход" : "Номенклатура"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold text-slate-50">{input.qty}</div>
                    <div
                      className={[
                        "mt-1 text-xs uppercase tracking-[0.18em]",
                        isExternal ? "text-amber-100/60" : "text-slate-400",
                      ].join(" ")}
                    >
                      {input.unit}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <Cog className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-medium text-slate-50">Оборудование</div>
          </div>
        </div>

        <div className="space-y-3">
          {step.equipment.map((machine) => {
            const isPrimary = machine.role === "primary";

            return (
              <div
                key={`${step.id}-${machine.name}`}
                className={[
                  "rounded-none border px-4 py-4",
                  isPrimary
                    ? "border-cyan-300/24 bg-[linear-gradient(180deg,rgba(20,95,118,0.3),rgba(10,34,49,0.72))] shadow-cyanGlow"
                    : "border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {machine.label}
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-50">{machine.name}</div>
                  </div>
                  <div className="rounded-none border border-white/10 px-2.5 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">
                    {machine.role}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                  <Gauge className="h-4 w-4 text-cyan-200" />
                  <span>
                    {machine.rate} {machine.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6 rounded-none border border-cyan-300/8 bg-[linear-gradient(180deg,rgba(18,31,43,0.72),rgba(10,19,29,0.76))] px-4 py-4">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Boxes className="h-4 w-4 text-cyan-200" />
          <span>Маршрут готов к переходу на API-модель шагов и входов.</span>
        </div>
      </div>
    </aside>
  );
}

export default StepDetailsPanel;
