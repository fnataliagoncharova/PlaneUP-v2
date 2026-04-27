import { ArrowRight, Boxes, CheckCircle2, PencilLine, ScrollText } from "lucide-react";

function DataTile({ label, value, tone = "cyan" }) {
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

function NomenclatureDetailsPanel({
  item,
  onEdit,
  productionRoute,
  productionRouteSteps,
  isProductionRouteLoading,
  productionRouteError,
  onOpenRoute,
}) {
  if (!item) {
    return (
      <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
        <div className="flex min-h-[420px] items-center justify-center text-center">
          <div className="max-w-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center text-cyan-100">
              <Boxes className="h-8 w-8" />
            </div>
            <h2 className="mt-6 font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">
              Позиция не выбрана
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Выберите позицию в списке слева, чтобы посмотреть карточку номенклатуры.
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
          <div className="panel-title">Выбранная позиция</div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            {item.nomenclature_name}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Карточка номенклатуры из V2-справочника. Данные синхронизированы с backend API.
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
        </div>
      </div>

      <div className="panel-divider mt-5" />

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Карточка позиции</div>
        </div>

        <div className="rounded-none border border-cyan-100/56 bg-[linear-gradient(180deg,rgba(32,174,207,0.34),rgba(16,78,107,0.82))] px-5 py-5 shadow-[0_0_0_1px_rgba(125,246,255,0.2),inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_rgba(34,211,238,0.28)]">
          <div className="text-sm uppercase tracking-[0.22em] text-cyan-100/72">
            {item.nomenclature_code}
          </div>
          <div className="mt-3 text-[1.36rem] font-semibold leading-tight text-cyan-50">
            {item.nomenclature_name}
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.2em] text-cyan-100/60">
            Единица: {item.unit_of_measure}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Статус и атрибуты</div>
        </div>

        <div className="grid gap-3">
          <DataTile label="Активность" value={item.is_active ? "Активна" : "Неактивна"} />
          <DataTile
            label="Единица измерения"
            value={item.unit_of_measure}
            tone={item.unit_of_measure === "м²" ? "cyan" : "amber"}
          />
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <ScrollText className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Маршрут</div>
        </div>

        {isProductionRouteLoading ? (
          <div className="rounded-none border border-cyan-300/20 bg-cyan-500/[0.05] px-4 py-4 text-sm text-slate-300">
            Загружаем маршрут...
          </div>
        ) : productionRouteError ? (
          <div className="rounded-none border border-rose-300/26 bg-rose-500/[0.08] px-4 py-4 text-sm text-rose-100">
            {productionRouteError}
          </div>
        ) : !productionRoute ? (
          <div className="rounded-none border border-cyan-300/16 bg-slate-900/35 px-4 py-4 text-sm text-slate-400">
            Маршрут не задан
          </div>
        ) : (
          <div className="rounded-none border border-cyan-100/22 bg-[linear-gradient(180deg,rgba(19,76,98,0.2),rgba(8,27,40,0.72))] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">
              {productionRoute.route_code}
            </div>
            <div className="mt-2 text-base font-medium text-cyan-50">{productionRoute.route_name}</div>

            <div className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-500">Шаги</div>
            {productionRouteSteps.length === 0 ? (
              <div className="mt-2 text-sm text-slate-400">Шаги маршрута не добавлены.</div>
            ) : (
              <ol className="mt-2 space-y-2">
                {productionRouteSteps.map((step) => (
                  <li
                    key={step.route_step_id}
                    className="border border-cyan-300/12 bg-cyan-500/[0.04] px-3 py-2 text-sm text-slate-200"
                  >
                    {step.step_no}. {step.process_label}
                  </li>
                ))}
              </ol>
            )}

            <button
              type="button"
              onClick={onOpenRoute}
              className="mt-4 inline-flex items-center gap-2 rounded-none border border-cyan-400/28 bg-cyan-400/10 px-3.5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-50 transition hover:bg-cyan-400/16"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Открыть маршрут
            </button>
          </div>
        )}
      </section>
    </aside>
  );
}

export default NomenclatureDetailsPanel;
