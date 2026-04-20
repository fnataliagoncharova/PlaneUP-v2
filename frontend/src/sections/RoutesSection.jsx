import { GitBranchPlus, PencilLine } from "lucide-react";
import { useEffect, useState } from "react";

import RouteList from "../components/routes/RouteList";
import RouteStepsFlow from "../components/routes/RouteStepsFlow";
import StepDetailsPanel from "../components/routes/StepDetailsPanel";
import { demoRoutes } from "../data/demoRoutes";

function RoutesSection() {
  const [selectedRouteId, setSelectedRouteId] = useState(demoRoutes[0].id);
  const selectedRoute =
    demoRoutes.find((route) => route.id === selectedRouteId) ?? demoRoutes[0];

  const [selectedStepId, setSelectedStepId] = useState(
    selectedRoute.defaultStepId ?? selectedRoute.steps[0].id,
  );

  useEffect(() => {
    setSelectedStepId(selectedRoute.defaultStepId ?? selectedRoute.steps[0].id);
  }, [selectedRoute]);

  const selectedStep =
    selectedRoute.steps.find((step) => step.id === selectedStepId) ?? selectedRoute.steps[0];

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(0,0.88fr)] 2xl:grid-cols-[minmax(0,1.24fr)_minmax(0,0.92fr)]">
      <div className="space-y-6">
        <header className="glass-panel p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="font-['Space_Grotesk'] text-3xl font-semibold text-slate-50 sm:text-4xl">
                Маршрут: {selectedRoute.code} {selectedRoute.name}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                {selectedRoute.subtitle} Интерфейс построен как живой каркас V2-системы:
                маршруты, шаги, входы, результат и оборудование уже разложены так, чтобы
                следующий шаг был подключением backend API.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
              >
                <GitBranchPlus className="h-4 w-4" />
                Новый маршрут
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]"
              >
                <PencilLine className="h-4 w-4" />
                Редактировать
              </button>
            </div>
          </div>
        </header>

        <RouteStepsFlow
          steps={selectedRoute.steps}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
        />

        <RouteList
          routes={demoRoutes}
          selectedRouteId={selectedRoute.id}
          onSelectRoute={setSelectedRouteId}
        />
      </div>

      <StepDetailsPanel route={selectedRoute} step={selectedStep} />
    </section>
  );
}

export default RoutesSection;
