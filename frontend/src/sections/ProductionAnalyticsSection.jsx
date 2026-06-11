import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gauge,
  LineChart,
  Target,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getMonthlyOutputAnalytics } from "../services/productionAnalyticsApi";

const TAB_PLAN_COMPLETION = "plan_completion";
const TAB_EQUIPMENT_DOWNTIME = "equipment_downtime";

const TABS = [
  { id: TAB_PLAN_COMPLETION, label: "Выполнение плана" },
  { id: TAB_EQUIPMENT_DOWNTIME, label: "Оборудование и простои" },
];

function getCurrentMonthValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  const localDate = new Date(now.getTime() - timezoneOffsetMs);
  return localDate.toISOString().slice(0, 7);
}

function toErrorMessage(error, fallbackText) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackText;
}

function formatQty(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(number);
}

function formatPercent(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(number)}%`;
}

function getStatusTone(status) {
  if (status === "completed") {
    return "border-emerald-900/50 bg-emerald-500/[0.14] text-emerald-100";
  }
  if (status === "overproduced") {
    return "border-cyan-900/50 bg-cyan-400/[0.14] text-cyan-100";
  }
  if (status === "no_plan") {
    return "border-violet-900/50 bg-violet-500/[0.14] text-violet-100";
  }
  if (status === "in_progress") {
    return "border-amber-900/50 bg-amber-500/[0.16] text-amber-100";
  }
  if (status === "no_actual") {
    return "border-slate-700/70 bg-slate-500/[0.16] text-slate-100";
  }
  return "border-slate-700/70 bg-white/[0.04] text-slate-200";
}

function buildEmptyAnalytics(monthValue) {
  const monthLabel = String(monthValue || getCurrentMonthValue());
  const dateFrom = `${monthLabel}-01`;
  const year = Number(monthLabel.slice(0, 4));
  const month = Number(monthLabel.slice(5, 7));
  const nextMonth =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  return {
    month: monthLabel,
    date_from: dateFrom,
    date_to: nextMonth,
    summary: {
      planned_qty_total: 0,
      actual_qty_total: 0,
      remaining_qty_total: 0,
      completion_percent: 0,
      underproduced_items_count: 0,
      overproduced_items_count: 0,
      no_actual_items_count: 0,
      no_plan_items_count: 0,
    },
    top_problem_items: [],
    items: [],
  };
}

function ProductionAnalyticsSection() {
  const [activeTab, setActiveTab] = useState(TAB_PLAN_COMPLETION);
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue);
  const [onlyWithDeviations, setOnlyWithDeviations] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(() => buildEmptyAnalytics(getCurrentMonthValue()));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const response = await getMonthlyOutputAnalytics({
        month: monthValue,
        only_with_deviations: onlyWithDeviations,
      });
      setAnalyticsData(response ?? buildEmptyAnalytics(monthValue));
    } catch (error) {
      setAnalyticsData(buildEmptyAnalytics(monthValue));
      setLoadError(toErrorMessage(error, "Не удалось загрузить аналитику выпуска."));
    } finally {
      setIsLoading(false);
    }
  }, [monthValue, onlyWithDeviations]);

  useEffect(() => {
    if (activeTab !== TAB_PLAN_COMPLETION) {
      return;
    }

    loadAnalytics();
  }, [activeTab, loadAnalytics]);

  const summary = analyticsData.summary ?? buildEmptyAnalytics(monthValue).summary;
  const topProblemItems = analyticsData.top_problem_items ?? [];
  const items = analyticsData.items ?? [];

  const kpiCards = useMemo(
    () => [
      {
        label: "План на месяц",
        value: `${formatQty(summary.planned_qty_total)} кг`,
        icon: Target,
        tone: {
          card: "bg-[linear-gradient(180deg,rgba(15,34,49,0.98),rgba(9,23,36,0.98))]",
          iconBox: "bg-cyan-400/[0.10] text-cyan-100",
          value: "text-slate-50",
        },
      },
      {
        label: "Выпущено",
        value: `${formatQty(summary.actual_qty_total)} кг`,
        icon: CheckCircle2,
        tone: {
          card: "bg-[linear-gradient(180deg,rgba(16,34,41,0.98),rgba(10,24,31,0.98))]",
          iconBox: "bg-emerald-400/[0.10] text-emerald-100",
          value: "text-emerald-50",
        },
      },
      {
        label: "Остаток к выпуску",
        value: `${formatQty(summary.remaining_qty_total)} кг`,
        icon: TriangleAlert,
        tone: {
          card: "bg-[linear-gradient(180deg,rgba(38,28,17,0.98),rgba(24,19,12,0.98))]",
          iconBox: "bg-amber-400/[0.10] text-amber-100",
          value: "text-amber-50",
        },
      },
      {
        label: "Выполнение",
        value: formatPercent(summary.completion_percent),
        icon: BarChart3,
        tone: {
          card: "bg-[linear-gradient(180deg,rgba(22,27,45,0.98),rgba(12,18,33,0.98))]",
          iconBox: "bg-indigo-400/[0.10] text-indigo-100",
          value: "text-slate-50",
        },
      },
    ],
    [
      summary.actual_qty_total,
      summary.completion_percent,
      summary.planned_qty_total,
      summary.remaining_qty_total,
    ],
  );

  const problemItemsCount = useMemo(
    () => items.filter((item) => Number(item.planned_qty) > Number(item.actual_qty)).length,
    [items],
  );

  const summaryCards = useMemo(
    () => [
      {
        label: "Позиций с недовыпуском",
        value: summary.underproduced_items_count,
      },
      {
        label: "Позиций без факта",
        value: summary.no_actual_items_count,
      },
      {
        label: "Позиций с перевыпуском",
        value: summary.overproduced_items_count,
      },
      {
        label: "Позиций без плана",
        value: summary.no_plan_items_count,
      },
    ],
    [
      summary.no_actual_items_count,
      summary.no_plan_items_count,
      summary.overproduced_items_count,
      summary.underproduced_items_count,
    ],
  );

  return (
    <section className="space-y-5">
      <header className="glass-panel px-5 py-5 sm:px-6">
        <div className="max-w-4xl">
          <h1 className="font-['Space_Grotesk'] text-3xl font-semibold tracking-tight text-slate-50 sm:text-[2rem]">
            Анализ выпуска
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Контроль выполнения месячного плана выпуска и анализ производственных отклонений.
          </p>
        </div>

        {loadError && activeTab === TAB_PLAN_COMPLETION ? (
          <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        ) : null}
      </header>

      <div className="glass-panel border-slate-800/70 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "min-w-[196px] rounded-none border px-5 py-3 text-sm font-medium transition",
                  isActive
                    ? "border-cyan-900/45 bg-cyan-400/[0.12] text-cyan-50"
                    : "border-slate-800/70 bg-white/[0.03] text-slate-300 hover:border-slate-700/80 hover:bg-slate-900/30",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === TAB_PLAN_COMPLETION ? (
        <div className="glass-panel border-slate-800/70 px-4 py-4 sm:px-5 sm:py-5">
          <div className="border-b border-slate-800/70 pb-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="text-sm font-medium text-slate-300">Период</span>
                  <input
                    type="month"
                    value={monthValue}
                    onChange={(event) => setMonthValue(event.target.value)}
                    className="h-10 min-w-[118px] rounded-none border border-slate-800/70 bg-slate-950/30 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-900/60"
                  />
                </label>

                <label className="inline-flex h-10 items-center gap-3 rounded-none border border-slate-800/70 bg-slate-950/30 px-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={onlyWithDeviations}
                    onChange={(event) => setOnlyWithDeviations(event.target.checked)}
                    className="h-4 w-4 rounded-none border-slate-700 bg-transparent text-cyan-300 focus:ring-cyan-900/30"
                  />
                  Только с отклонениями
                </label>
              </div>

              <button
                type="button"
                onClick={loadAnalytics}
                className="h-10 rounded-none border border-cyan-900/50 bg-cyan-400/[0.10] px-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.14]"
              >
                Обновить
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-row gap-4">
            {kpiCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.label}
                  className={[
                    "min-w-0 flex-1 rounded-none border border-slate-800/70 px-5 py-4 transition",
                    card.tone.card,
                  ].join(" ")}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={[
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-none border border-slate-700/70",
                        card.tone.iconBox,
                      ].join(" ")}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-400">{card.label}</div>
                      <div
                        className={[
                          "mt-1.5 text-[2rem] font-semibold leading-none tracking-tight",
                          card.tone.value,
                        ].join(" ")}
                      >
                        {card.value}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
            <section className="glass-panel p-4 sm:p-5">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-50">
                  Проблемные позиции
                </h2>
                <span className="text-sm text-slate-500">(топ-5 по остатку)</span>
              </div>

              {isLoading ? (
                <div className="mt-5 text-sm text-slate-300">Загружаем проблемные позиции...</div>
              ) : topProblemItems.length === 0 ? (
                <div className="mt-5 rounded-none border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                  Нет позиций с остатком к выпуску за выбранный месяц.
                </div>
              ) : (
                <>
                  <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10">
                    <div className="max-h-[430px] overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium">Код</th>
                            <th className="px-3 py-3 text-left text-xs font-medium">Номенклатура</th>
                            <th className="px-3 py-3 text-right text-xs font-medium">План</th>
                            <th className="px-3 py-3 text-right text-xs font-medium">Факт</th>
                            <th className="px-3 py-3 text-right text-xs font-medium">Остаток</th>
                            <th className="px-3 py-3 text-right text-xs font-medium">%</th>
                            <th className="px-3 py-3 text-left text-xs font-medium">Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topProblemItems.map((item) => (
                            <tr
                              key={`${item.nomenclature_id}-${item.item_code}`}
                              className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]"
                            >
                              <td className="px-3 py-3 font-medium text-slate-100">{item.item_code}</td>
                              <td className="px-3 py-3 text-slate-200">{item.item_name}</td>
                              <td className="px-3 py-3 text-right text-slate-200">
                                {formatQty(item.planned_qty)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-200">
                                {formatQty(item.actual_qty)}
                              </td>
                              <td className="px-3 py-3 text-right font-medium text-amber-300">
                                {formatQty(item.remaining_qty)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-200">
                                {formatPercent(item.completion_percent)}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={[
                                    "inline-flex items-center rounded-none border px-2.5 py-1 text-xs font-medium",
                                    getStatusTone(item.status),
                                  ].join(" ")}
                                >
                                  {item.status_label}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="mt-4 flex w-full items-center justify-between rounded-none border border-cyan-300/10 bg-[rgba(8,22,34,0.52)] px-4 py-3 text-sm text-slate-300 transition hover:bg-cyan-300/[0.03]"
                  >
                    <span>Показать все проблемные позиции ({problemItemsCount})</span>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </button>
                </>
              )}
            </section>

            <section className="glass-panel p-4 sm:p-5">
              <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-50">
                План-факт по номенклатуре
              </h2>

              {isLoading ? (
                <div className="mt-5 text-sm text-slate-300">Загружаем план-факт выпуска...</div>
              ) : items.length === 0 ? (
                <div className="mt-5 rounded-none border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                  Нет данных для отображения за выбранный месяц.
                </div>
              ) : (
                <>
                  <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10">
                    <div className="max-h-[430px] overflow-auto">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium">Код</th>
                            <th className="px-3 py-3 text-left text-xs font-medium">Номенклатура</th>
                            <th className="px-3 py-3 text-right text-xs font-medium">План</th>
                            <th className="px-3 py-3 text-right text-xs font-medium">Факт</th>
                            <th className="px-3 py-3 text-right text-xs font-medium">Осталось</th>
                            <th className="px-3 py-3 text-right text-xs font-medium">%</th>
                            <th className="px-3 py-3 text-left text-xs font-medium">Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr
                              key={`${item.nomenclature_id}-${item.item_code}`}
                              className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]"
                            >
                              <td className="px-3 py-3 font-medium text-slate-100">{item.item_code}</td>
                              <td className="px-3 py-3 text-slate-200">{item.item_name}</td>
                              <td className="px-3 py-3 text-right text-slate-200">
                                {formatQty(item.planned_qty)}
                              </td>
                              <td className="px-3 py-3 text-right text-slate-200">
                                {formatQty(item.actual_qty)}
                              </td>
                              <td
                                className={[
                                  "px-3 py-3 text-right",
                                  Number(item.remaining_qty) > 0 ? "text-amber-300" : "text-slate-200",
                                ].join(" ")}
                              >
                                {formatQty(item.remaining_qty)}
                              </td>
                              <td
                                className={[
                                  "px-3 py-3 text-right font-medium",
                                  item.status === "completed"
                                    ? "text-emerald-300"
                                    : item.status === "in_progress"
                                      ? "text-amber-300"
                                      : item.status === "overproduced"
                                        ? "text-cyan-300"
                                        : item.status === "no_plan"
                                          ? "text-violet-300"
                                          : "text-rose-300",
                                ].join(" ")}
                              >
                                {formatPercent(item.completion_percent)}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className={[
                                    "inline-flex items-center rounded-none border px-2.5 py-1 text-xs font-medium",
                                    getStatusTone(item.status),
                                  ].join(" ")}
                                >
                                  {item.status_label}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="mt-4 flex w-full items-center justify-between rounded-none border border-cyan-300/10 bg-[rgba(8,22,34,0.52)] px-4 py-3 text-sm text-slate-300 transition hover:bg-cyan-300/[0.03]"
                  >
                    <span>Показать все номенклатуры ({items.length})</span>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </button>
                </>
              )}
            </section>
          </div>

          <section className="glass-panel mt-4 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border border-slate-700/70 bg-cyan-400/[0.08] text-cyan-100">
                <LineChart className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight text-slate-50">Сводка периода</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  {summaryCards.map((card) => (
                    <div key={card.label} className="flex items-start gap-3">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                      <span>
                        {card.label}: <span className="font-medium text-slate-100">{card.value}</span>
                      </span>
                    </div>
                  ))}
                  <div className="flex items-start gap-3 pt-1 text-slate-300">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                    <span>Для анализа загрузки ресурсов откройте вкладку “Оборудование и простои”.</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <section className="glass-panel px-5 py-6 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight text-slate-50">Оборудование и простои</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Информация о загрузке оборудования и внеплановых простоях будет добавлена следующим шагом.
          </p>
        </section>
      )}
    </section>
  );
}

export default ProductionAnalyticsSection;
