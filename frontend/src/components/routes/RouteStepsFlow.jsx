import { ChevronRight, Goal } from "lucide-react";

function RouteStepsFlow({ steps, selectedStepId, onSelectStep }) {
  return (
    <section className="glass-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">
            Технологический маршрут
          </h2>
        </div>
        <div className="tech-chip">
          <Goal className="h-4 w-4" />
          Выберите шаг
        </div>
      </div>

      <div className="panel-divider mt-5" />

      <div className="mt-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
          {steps.map((step, index) => {
            const isSelected = step.id === selectedStepId;
            const isLast = index === steps.length - 1;

            return (
              <div key={step.id} className="flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
                <button
                  type="button"
                  onClick={() => onSelectStep(step.id)}
                  className={[
                    "group relative flex min-h-[112px] min-w-0 flex-1 flex-col justify-between rounded-none border px-4 py-3 text-left transition-all duration-200 lg:px-5",
                    isSelected
                      ? "border-cyan-200/60 bg-[linear-gradient(90deg,rgba(18,128,161,0.58),rgba(8,35,50,0.96))] shadow-[0_0_0_1px_rgba(103,232,249,0.18),inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_rgba(34,211,238,0.24)]"
                      : "border-cyan-300/20 bg-[linear-gradient(180deg,rgba(22,48,64,0.76),rgba(13,25,37,0.84))]",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={[
                        "rounded-none px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.22em]",
                        isSelected
                          ? "border border-cyan-200/35 bg-cyan-300/18 text-cyan-50"
                          : "bg-white/[0.05] text-slate-400",
                      ].join(" ")}
                    >
                      Шаг {step.number}
                    </span>
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {step.process.split(" ")[0]}
                    </span>
                  </div>

                  <div className="mt-3 whitespace-normal break-words font-['Space_Grotesk'] text-lg font-semibold leading-tight text-slate-50 xl:text-xl">
                    {step.title}
                  </div>

                  {isSelected ? (
                    <div className="absolute inset-x-8 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-cyan-200 to-transparent" />
                  ) : null}
                </button>

                {!isLast ? (
                  <div className="flex items-center justify-center lg:pr-1">
                    <ChevronRight className="h-7 w-7 text-cyan-200/90 drop-shadow-[0_0_12px_rgba(34,211,238,0.42)]" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default RouteStepsFlow;
