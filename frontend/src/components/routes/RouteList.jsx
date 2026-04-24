import { ChevronRight, Layers3, Network, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function RouteList({
  routes,
  isLoading,
  selectedRouteId,
  onSelectRoute,
  getResultNomenclatureLabel,
}) {
  const [searchValue, setSearchValue] = useState("");

  const filteredRoutes = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return routes;
    }

    return routes.filter((route) => {
      const codeMatches = route.route_code.toLowerCase().includes(normalizedSearch);
      const nameMatches = route.route_name.toLowerCase().includes(normalizedSearch);

      return codeMatches || nameMatches;
    });
  }, [routes, searchValue]);

  useEffect(() => {
    if (filteredRoutes.length === 0) {
      return;
    }

    const hasSelectedRoute = filteredRoutes.some((route) => route.route_id === selectedRouteId);

    if (!hasSelectedRoute) {
      onSelectRoute(filteredRoutes[0].route_id);
    }
  }, [filteredRoutes, onSelectRoute, selectedRouteId]);

  return (
    <section className="glass-panel p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="panel-title">Маршруты</div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">
            Список маршрутов
          </h2>
        </div>
        <div className="tech-chip">
          <Network className="h-4 w-4" />
          Backend API
        </div>
      </div>

      <div className="panel-divider mt-5" />

      <div className="mt-5">
        <label className="flex items-center gap-3 border border-white/[0.05] bg-[linear-gradient(180deg,rgba(17,29,42,0.72),rgba(10,18,28,0.8))] px-4 py-3 text-slate-300 transition focus-within:border-cyan-200/18 focus-within:bg-[linear-gradient(180deg,rgba(20,37,52,0.78),rgba(11,21,31,0.84))]">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Поиск по коду или названию"
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </label>
      </div>

      <div className="mt-5 space-y-3">
        {isLoading ? (
          <div className="border border-white/[0.05] bg-[linear-gradient(180deg,rgba(16,26,37,0.58),rgba(10,18,27,0.7))] px-5 py-8 text-center">
            <div className="text-base font-medium text-slate-200">Загрузка маршрутов...</div>
          </div>
        ) : filteredRoutes.length > 0 ? (
          filteredRoutes.map((route) => {
            const isSelected = route.route_id === selectedRouteId;

            return (
              <button
                key={route.route_id}
                type="button"
                onClick={() => onSelectRoute(route.route_id)}
                className={[
                  "group relative flex w-full items-start gap-4 overflow-hidden rounded-none border px-4 py-4 text-left transition-all duration-200",
                  isSelected
                    ? "border-cyan-200/60 bg-[linear-gradient(90deg,rgba(18,128,161,0.58),rgba(8,35,50,0.96))] shadow-[0_0_0_1px_rgba(103,232,249,0.18),inset_0_1px_0_rgba(255,255,255,0.06),0_0_40px_rgba(34,211,238,0.24)]"
                    : "border-white/[0.035] bg-[linear-gradient(180deg,rgba(15,24,35,0.42),rgba(10,18,27,0.52))] hover:border-cyan-200/[0.10] hover:bg-[linear-gradient(180deg,rgba(18,37,50,0.56),rgba(10,21,31,0.64))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(56,189,248,0.03)]",
                ].join(" ")}
              >
                {isSelected ? (
                  <>
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-[linear-gradient(90deg,rgba(34,211,238,0.24),rgba(34,211,238,0.08),transparent)]" />
                  </>
                ) : null}
                <div
                  className={[
                    "relative z-10 mt-1 flex h-11 w-11 items-center justify-center rounded-none border",
                    isSelected
                      ? "border-cyan-200/45 bg-cyan-300/18 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.18)]"
                      : "border-white/[0.04] bg-slate-950/58 text-slate-500 group-hover:border-cyan-200/[0.08] group-hover:text-cyan-100/85",
                  ].join(" ")}
                >
                  <Layers3 className="h-5 w-5" />
                </div>

                <div className="relative z-10 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-['Space_Grotesk'] text-xl font-semibold text-slate-50">
                      {route.route_code}
                    </span>
                    <span
                      className={[
                        "rounded-none border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em]",
                        route.is_active
                          ? "border-cyan-200/24 bg-cyan-300/10 text-cyan-100/80"
                          : "border-amber-200/62 bg-[linear-gradient(180deg,rgba(251,191,36,0.30),rgba(180,83,9,0.24))] text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_0_1px_rgba(251,191,36,0.12)]",
                      ].join(" ")}
                    >
                      {route.is_active ? "Активен" : "Неактивен"}
                    </span>
                  </div>
                  <div className="mt-2 text-base text-slate-200">{route.route_name}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    Выход: {getResultNomenclatureLabel(route.result_nomenclature_id)}
                  </div>
                </div>

                <ChevronRight
                  className={[
                    "relative z-10 mt-3 h-5 w-5 shrink-0 transition-all duration-200",
                    isSelected
                      ? "translate-x-1 text-cyan-100"
                      : "text-slate-600 group-hover:translate-x-1 group-hover:text-cyan-100/70",
                  ].join(" ")}
                />
              </button>
            );
          })
        ) : (
          <div className="border border-white/[0.05] bg-[linear-gradient(180deg,rgba(16,26,37,0.58),rgba(10,18,27,0.7))] px-5 py-8 text-center">
            <div className="text-base font-medium text-slate-200">Маршруты не найдены</div>
            <div className="mt-2 text-sm text-slate-500">
              Попробуйте изменить код или название в строке поиска.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default RouteList;

