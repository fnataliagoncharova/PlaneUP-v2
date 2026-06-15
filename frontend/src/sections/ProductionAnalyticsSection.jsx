import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cog,
  Gauge,
  LineChart,
  PieChart,
  Printer,
  RefreshCw,
  Target,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getEquipmentMonthlyAnalytics,
  getMonthlyOutputAnalytics,
  printProductionAnalytics,
} from "../services/productionAnalyticsApi";

const TAB_PLAN_COMPLETION = "plan_completion";
const TAB_EQUIPMENT_DOWNTIME = "equipment_downtime";
const MAX_KPI_UNIT_LINES = 3;

const TABS = [
  { id: TAB_PLAN_COMPLETION, label: "Выполнение плана" },
  { id: TAB_EQUIPMENT_DOWNTIME, label: "Обеспеченность мощностями" },
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

function buildProductionAnalyticsFileName(month) {
  return `Анализ_выпуска_${month || getCurrentMonthValue()}.xlsx`;
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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

function formatQtyThousands(value) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) {
    return "— тыс.";
  }

  const formattedValue = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(number / 1000);

  return `${formattedValue} тыс.`;
}

function buildQtyByUnitLines(summaryByUnit, qtyField, fallbackValue) {
  const rows = Array.isArray(summaryByUnit) ? summaryByUnit : [];
  const lines = rows.map((row) => ({
    value: formatQtyThousands(row?.[qtyField]),
    unit: String(row?.unit || "").trim() || "Без ед.",
  }));

  if (lines.length === 0) {
    return {
      lines: [{ value: formatQtyThousands(fallbackValue), unit: "" }],
      extraCount: 0,
    };
  }

  return {
    lines: lines.slice(0, MAX_KPI_UNIT_LINES),
    extraCount: Math.max(lines.length - MAX_KPI_UNIT_LINES, 0),
  };
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

function formatHours(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(number);
}

function getOutputStatusTone(status) {
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

function getEquipmentStatusTone(status) {
  if (status === "normal") {
    return "border-emerald-900/50 bg-emerald-500/[0.14] text-emerald-100";
  }
  if (status === "no_load") {
    return "border-slate-700/70 bg-slate-500/[0.16] text-slate-100";
  }
  if (status === "high_load") {
    return "border-amber-900/50 bg-amber-500/[0.16] text-amber-100";
  }
  if (status === "overloaded") {
    return "border-rose-900/50 bg-rose-500/[0.16] text-rose-100";
  }
  return "border-slate-700/70 bg-slate-500/[0.16] text-slate-100";
}

function getEquipmentLoadBarTone(status, loadPercent) {
  const numericPercent = Number(loadPercent);
  if (!Number.isFinite(numericPercent)) {
    return "bg-slate-500/60";
  }
  if (status === "overloaded" || numericPercent > 100) {
    return "bg-rose-400/80";
  }
  if (status === "high_load" || numericPercent >= 85) {
    return "bg-amber-400/80";
  }
  if (status === "no_load") {
    return "bg-slate-500/70";
  }
  return "bg-emerald-400/80";
}

function getEquipmentLoadDisplay(item) {
  const plannedLoadHours = item?.planned_load_hours;
  const numericPlannedLoad = Number(plannedLoadHours ?? 0);
  if ((plannedLoadHours === null || plannedLoadHours === undefined || numericPlannedLoad === 0) && item?.status === "normal") {
    return {
      status: "no_load",
      status_label: "Нет загрузки",
    };
  }
  return {
    status: item?.status ?? "no_capacity_data",
    status_label: item?.status_label ?? "Нет данных",
  };
}

function buildEmptyOutputAnalytics(monthValue) {
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
    summary_by_unit: [],
    top_problem_items: [],
    items: [],
  };
}

function buildEmptyEquipmentAnalytics(monthValue) {
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
      equipment_in_plan_count: 0,
      average_load_percent: 0,
      overloaded_equipment_count: 0,
      high_load_equipment_count: 0,
      total_downtime_hours: 0,
      planned_maintenance_hours: 0,
      unplanned_downtime_hours: 0,
      unplanned_share_percent: 0,
    },
    equipment_load: [],
    downtime_by_category: [],
    downtimes: [],
  };
}

function ProductionAnalyticsSection() {
  const [activeTab, setActiveTab] = useState(TAB_PLAN_COMPLETION);
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue);
  const [onlyWithDeviations, setOnlyWithDeviations] = useState(false);

  const [outputAnalyticsData, setOutputAnalyticsData] = useState(() =>
    buildEmptyOutputAnalytics(getCurrentMonthValue()),
  );
  const [isOutputLoading, setIsOutputLoading] = useState(true);
  const [outputLoadError, setOutputLoadError] = useState("");

  const [equipmentAnalyticsData, setEquipmentAnalyticsData] = useState(() =>
    buildEmptyEquipmentAnalytics(getCurrentMonthValue()),
  );
  const [isEquipmentLoading, setIsEquipmentLoading] = useState(false);
  const [equipmentLoadError, setEquipmentLoadError] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);

  const loadOutputAnalytics = useCallback(async () => {
    setIsOutputLoading(true);
    setOutputLoadError("");

    try {
      const response = await getMonthlyOutputAnalytics({
        month: monthValue,
        only_with_deviations: onlyWithDeviations,
      });
      setOutputAnalyticsData(response ?? buildEmptyOutputAnalytics(monthValue));
    } catch (error) {
      setOutputAnalyticsData(buildEmptyOutputAnalytics(monthValue));
      setOutputLoadError(toErrorMessage(error, "Не удалось загрузить аналитику выпуска."));
    } finally {
      setIsOutputLoading(false);
    }
  }, [monthValue, onlyWithDeviations]);

  const loadEquipmentAnalytics = useCallback(async () => {
    setIsEquipmentLoading(true);
    setEquipmentLoadError("");

    try {
      const response = await getEquipmentMonthlyAnalytics({ month: monthValue });
      setEquipmentAnalyticsData(response ?? buildEmptyEquipmentAnalytics(monthValue));
    } catch (error) {
      setEquipmentAnalyticsData(buildEmptyEquipmentAnalytics(monthValue));
      setEquipmentLoadError(
        toErrorMessage(error, "Не удалось загрузить аналитику по оборудованию."),
      );
    } finally {
      setIsEquipmentLoading(false);
    }
  }, [monthValue]);

  const handlePrintAnalytics = useCallback(async () => {
    setIsPrinting(true);
    setOutputLoadError("");
    setEquipmentLoadError("");

    try {
      const blob = await printProductionAnalytics(monthValue);
      downloadBlob(blob, buildProductionAnalyticsFileName(monthValue));
    } catch (error) {
      const message = toErrorMessage(error, "Не удалось сформировать печатную форму анализа выпуска.");
      if (activeTab === TAB_EQUIPMENT_DOWNTIME) {
        setEquipmentLoadError(message);
      } else {
        setOutputLoadError(message);
      }
    } finally {
      setIsPrinting(false);
    }
  }, [activeTab, monthValue]);

  useEffect(() => {
    if (activeTab !== TAB_PLAN_COMPLETION) {
      return;
    }
    loadOutputAnalytics();
  }, [activeTab, loadOutputAnalytics]);

  useEffect(() => {
    if (activeTab !== TAB_EQUIPMENT_DOWNTIME) {
      return;
    }
    loadEquipmentAnalytics();
  }, [activeTab, loadEquipmentAnalytics]);

  const outputSummary = outputAnalyticsData.summary ?? buildEmptyOutputAnalytics(monthValue).summary;
  const topProblemItems = outputAnalyticsData.top_problem_items ?? [];
  const outputItems = outputAnalyticsData.items ?? [];
  const sortedOutputItems = useMemo(
    () =>
      [...outputItems].sort((leftItem, rightItem) => {
        const leftPercent = Number(leftItem?.completion_percent);
        const rightPercent = Number(rightItem?.completion_percent);
        const leftSortValue = Number.isFinite(leftPercent) ? leftPercent : Number.POSITIVE_INFINITY;
        const rightSortValue = Number.isFinite(rightPercent) ? rightPercent : Number.POSITIVE_INFINITY;

        if (leftSortValue !== rightSortValue) {
          return leftSortValue - rightSortValue;
        }

        const codeCompare = String(leftItem?.item_code || "").localeCompare(
          String(rightItem?.item_code || ""),
          "ru",
        );
        if (codeCompare !== 0) {
          return codeCompare;
        }

        return String(leftItem?.item_name || "").localeCompare(String(rightItem?.item_name || ""), "ru");
      }),
    [outputItems],
  );
  const outputSummaryByUnit = Array.isArray(outputAnalyticsData.summary_by_unit)
    ? outputAnalyticsData.summary_by_unit
    : [];
  const equipmentSummary =
    equipmentAnalyticsData.summary ?? buildEmptyEquipmentAnalytics(monthValue).summary;
  const equipmentLoadItems = equipmentAnalyticsData.equipment_load ?? [];
  const downtimeCategoryItems = equipmentAnalyticsData.downtime_by_category ?? [];
  const downtimeItems = equipmentAnalyticsData.downtimes ?? [];

  const outputKpiCards = useMemo(
    () => {
      const plannedQtyByUnit = buildQtyByUnitLines(
        outputSummaryByUnit,
        "planned_qty_total",
        outputSummary.planned_qty_total,
      );
      const actualQtyByUnit = buildQtyByUnitLines(
        outputSummaryByUnit,
        "actual_qty_total",
        outputSummary.actual_qty_total,
      );
      const remainingQtyByUnit = buildQtyByUnitLines(
        outputSummaryByUnit,
        "remaining_qty_total",
        outputSummary.remaining_qty_total,
      );

      return [
        {
          label: "План на месяц",
          quantityLines: plannedQtyByUnit.lines,
          extraUnitCount: plannedQtyByUnit.extraCount,
          icon: Target,
          tone: {
            card: "bg-[linear-gradient(180deg,rgba(15,34,49,0.98),rgba(9,23,36,0.98))]",
            iconBox: "bg-cyan-400/[0.10] text-cyan-100",
            value: "text-slate-50",
          },
        },
        {
          label: "Выпущено",
          quantityLines: actualQtyByUnit.lines,
          extraUnitCount: actualQtyByUnit.extraCount,
          icon: CheckCircle2,
          tone: {
            card: "bg-[linear-gradient(180deg,rgba(16,34,41,0.98),rgba(10,24,31,0.98))]",
            iconBox: "bg-emerald-400/[0.10] text-emerald-100",
            value: "text-emerald-50",
          },
        },
        {
          label: "Остаток к выпуску",
          quantityLines: remainingQtyByUnit.lines,
          extraUnitCount: remainingQtyByUnit.extraCount,
          icon: TriangleAlert,
          tone: {
            card: "bg-[linear-gradient(180deg,rgba(38,28,17,0.98),rgba(24,19,12,0.98))]",
            iconBox: "bg-amber-400/[0.10] text-amber-100",
            value: "text-amber-50",
          },
        },
        {
          label: "Выполнение",
          value: formatPercent(outputSummary.completion_percent),
          icon: BarChart3,
          tone: {
            card: "bg-[linear-gradient(180deg,rgba(22,27,45,0.98),rgba(12,18,33,0.98))]",
            iconBox: "bg-indigo-400/[0.10] text-indigo-100",
            value: "text-slate-50",
          },
        },
      ];
    },
    [
      outputSummary.actual_qty_total,
      outputSummary.completion_percent,
      outputSummary.planned_qty_total,
      outputSummary.remaining_qty_total,
      outputSummaryByUnit,
    ],
  );

  const equipmentKpiCards = useMemo(
    () => {
      const overloadedCount = Number(equipmentSummary.overloaded_equipment_count ?? 0);
      const hasOverload = Number.isFinite(overloadedCount) && overloadedCount > 0;

      return [
        {
          label: "Оборудование в плане",
          value: String(equipmentSummary.equipment_in_plan_count ?? 0),
          icon: Cog,
          tone: {
            card: "bg-[linear-gradient(180deg,rgba(15,34,49,0.98),rgba(9,23,36,0.98))]",
            iconBox: "bg-cyan-400/[0.10] text-cyan-100",
            value: "text-slate-50",
          },
        },
        {
          label: "Средняя загрузка",
          value: formatPercent(equipmentSummary.average_load_percent),
          icon: Gauge,
          tone: {
            card: "bg-[linear-gradient(180deg,rgba(16,34,41,0.98),rgba(10,24,31,0.98))]",
            iconBox: "bg-emerald-400/[0.10] text-emerald-100",
            value: "text-emerald-50",
          },
        },
        {
          label: "Перегружено",
          value: String(equipmentSummary.overloaded_equipment_count ?? 0),
          icon: TriangleAlert,
          tone: hasOverload
            ? {
                card: "bg-[linear-gradient(180deg,rgba(38,28,17,0.98),rgba(24,19,12,0.98))]",
                iconBox: "bg-amber-400/[0.10] text-amber-100",
                value: "text-amber-50",
              }
            : {
                card: "bg-[linear-gradient(180deg,rgba(18,31,43,0.98),rgba(10,22,34,0.98))]",
                iconBox: "bg-slate-400/[0.10] text-slate-200",
                value: "text-slate-50",
              },
        },
        {
          label: "Простои, ч",
          icon: Clock,
          value: formatHours(equipmentSummary.total_downtime_hours),
          downtimeDetails: [
            ["Плановое ТО", formatHours(equipmentSummary.planned_maintenance_hours)],
            ["Внеплановые", formatHours(equipmentSummary.unplanned_downtime_hours)],
          ],
          tone: {
            card: "bg-[linear-gradient(180deg,rgba(22,27,45,0.98),rgba(12,18,33,0.98))]",
            iconBox: "bg-indigo-400/[0.10] text-indigo-100",
            value: "text-slate-50",
          },
        },
        {
          label: "Доля внеплановых, %",
          value: formatPercent(equipmentSummary.unplanned_share_percent),
          icon: PieChart,
          tone: {
            card: "bg-[linear-gradient(180deg,rgba(24,26,49,0.98),rgba(14,18,37,0.98))]",
            iconBox: "bg-indigo-400/[0.10] text-indigo-100",
            value: "text-slate-50",
          },
        },
      ];
    },
    [
      equipmentSummary.average_load_percent,
      equipmentSummary.equipment_in_plan_count,
      equipmentSummary.overloaded_equipment_count,
      equipmentSummary.planned_maintenance_hours,
      equipmentSummary.total_downtime_hours,
      equipmentSummary.unplanned_downtime_hours,
      equipmentSummary.unplanned_share_percent,
    ],
  );

  const problemItemsCount = useMemo(
    () => outputItems.filter((item) => Number(item.planned_qty) > Number(item.actual_qty)).length,
    [outputItems],
  );

  const outputSummaryCards = useMemo(
    () => [
      {
        label: "Позиций с недовыпуском",
        value: outputSummary.underproduced_items_count,
      },
      {
        label: "Позиций без факта",
        value: outputSummary.no_actual_items_count,
      },
      {
        label: "Позиций с перевыпуском",
        value: outputSummary.overproduced_items_count,
      },
      {
        label: "Позиций без плана",
        value: outputSummary.no_plan_items_count,
      },
    ],
    [
      outputSummary.no_actual_items_count,
      outputSummary.no_plan_items_count,
      outputSummary.overproduced_items_count,
      outputSummary.underproduced_items_count,
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

        {activeTab === TAB_PLAN_COMPLETION && outputLoadError ? (
          <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{outputLoadError}</span>
          </div>
        ) : null}

        {activeTab === TAB_EQUIPMENT_DOWNTIME && equipmentLoadError ? (
          <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{equipmentLoadError}</span>
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  title="Печать отчёта анализа выпуска"
                  onClick={handlePrintAnalytics}
                  disabled={isPrinting}
                  className="inline-flex h-10 items-center gap-2 rounded-none border border-white/15 px-4 text-sm font-medium text-slate-100 transition hover:border-cyan-300/35 disabled:opacity-60"
                >
                  <Printer className="h-4 w-4" />
                  {isPrinting ? "Формируем..." : "Печать"}
                </button>
                <button
                  type="button"
                  onClick={loadOutputAnalytics}
                  disabled={isOutputLoading}
                  className="inline-flex h-10 items-center gap-2 rounded-none border border-cyan-900/50 bg-cyan-400/[0.10] px-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.14] disabled:opacity-60"
                >
                  <RefreshCw className={["h-4 w-4", isOutputLoading ? "animate-spin" : ""].join(" ")} />
                  Обновить
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-row gap-4">
            {outputKpiCards.map((card) => {
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
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-none border border-slate-700/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                        card.tone.iconBox,
                      ].join(" ")}
                    >
                      <Icon className="h-7 w-7" strokeWidth={1.9} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-400">{card.label}</div>
                      {card.quantityLines ? (
                        <div className="mt-1.5 space-y-1">
                          {card.quantityLines.map((line, index) => (
                            <div
                              key={`${card.label}-${line.unit || "fallback"}-${index}`}
                              className={[
                                "text-xl font-semibold leading-tight tracking-tight",
                                card.tone.value,
                              ].join(" ")}
                            >
                              <span>{line.value}</span>
                              {line.unit ? (
                                <span className="ml-1.5 font-medium text-slate-400">
                                  {line.unit}
                                </span>
                              ) : null}
                            </div>
                          ))}
                          {card.extraUnitCount > 0 ? (
                            <div className="text-xs font-medium text-slate-500">
                              + ещё {card.extraUnitCount} ед.
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div
                          className={[
                            "mt-1.5 text-[2rem] font-semibold leading-none tracking-tight",
                            card.tone.value,
                          ].join(" ")}
                        >
                          {card.value}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="glass-panel flex flex-col p-4 sm:p-5 xl:min-h-[560px]">
              <div className="flex items-baseline gap-2">
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-50">
                  Проблемные позиции
                </h2>
                <span className="text-sm text-slate-500">(топ-5 по остатку)</span>
              </div>

              {isOutputLoading ? (
                <div className="mt-5 text-sm text-slate-300">Загружаем проблемные позиции...</div>
              ) : topProblemItems.length === 0 ? (
                <div className="mt-5 rounded-none border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                  Нет позиций с остатком к выпуску за выбранный месяц.
                </div>
              ) : (
                <>
                  <div className="mt-4 flex-1 overflow-hidden rounded-none border border-cyan-300/10">
                    <div className="max-h-[430px] overflow-auto">
                      <table className="min-w-full text-xs xl:text-[0.8rem]">
                        <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                          <tr>
                            <th className="px-3 py-3 text-left font-medium">Код</th>
                            <th className="px-3 py-3 text-left font-medium">Номенклатура</th>
                            <th className="px-3 py-3 text-right font-medium">План</th>
                            <th className="px-3 py-3 text-right font-medium">Факт</th>
                            <th className="px-3 py-3 text-right font-medium">Остаток</th>
                            <th className="px-3 py-3 text-right font-medium">%</th>
                            <th className="px-3 py-3 text-left font-medium">Статус</th>
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
                                    getOutputStatusTone(item.status),
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

            <section className="glass-panel flex flex-col p-4 sm:p-5 xl:min-h-[560px]">
              <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-50">
                План-факт по номенклатуре
              </h2>

              {isOutputLoading ? (
                <div className="mt-5 text-sm text-slate-300">Загружаем план-факт выпуска...</div>
              ) : outputItems.length === 0 ? (
                <div className="mt-5 rounded-none border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                  Нет данных для отображения за выбранный месяц.
                </div>
              ) : (
                <>
                  <div className="mt-4 flex-1 overflow-hidden rounded-none border border-cyan-300/10">
                    <div className="max-h-[430px] overflow-auto">
                      <table className="min-w-full text-xs xl:text-[0.8rem]">
                        <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                          <tr>
                            <th className="px-3 py-3 text-left font-medium">Код</th>
                            <th className="px-3 py-3 text-left font-medium">Номенклатура</th>
                            <th className="px-3 py-3 text-right font-medium">План</th>
                            <th className="px-3 py-3 text-right font-medium">Факт</th>
                            <th className="px-3 py-3 text-right font-medium">Осталось</th>
                            <th className="px-3 py-3 text-right font-medium">%</th>
                            <th className="px-3 py-3 text-left font-medium">Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedOutputItems.map((item) => (
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
                                    getOutputStatusTone(item.status),
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
                    <span>Показать все номенклатуры ({outputItems.length})</span>
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
                  {outputSummaryCards.map((card) => (
                    <div key={card.label} className="flex items-start gap-3">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                      <span>
                        {card.label}: <span className="font-medium text-slate-100">{card.value}</span>
                      </span>
                    </div>
                  ))}
                  <div className="flex items-start gap-3 pt-1 text-slate-300">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                    <span>Для анализа загрузки ресурсов откройте вкладку “Обеспеченность мощностями”.</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="glass-panel border-slate-800/70 px-4 py-4 sm:px-5 sm:py-5">
          <div className="border-b border-slate-800/70 pb-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <span className="text-sm font-medium text-slate-300">Период</span>
                <input
                  type="month"
                  value={monthValue}
                  onChange={(event) => setMonthValue(event.target.value)}
                  className="h-10 min-w-[118px] rounded-none border border-slate-800/70 bg-slate-950/30 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-900/60"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  title="Печать отчёта анализа выпуска"
                  onClick={handlePrintAnalytics}
                  disabled={isPrinting}
                  className="inline-flex h-10 items-center gap-2 rounded-none border border-white/15 px-4 text-sm font-medium text-slate-100 transition hover:border-cyan-300/35 disabled:opacity-60"
                >
                  <Printer className="h-4 w-4" />
                  {isPrinting ? "Формируем..." : "Печать"}
                </button>
                <button
                  type="button"
                  onClick={loadEquipmentAnalytics}
                  disabled={isEquipmentLoading}
                  className="inline-flex h-10 items-center gap-2 rounded-none border border-cyan-900/50 bg-cyan-400/[0.10] px-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.14] disabled:opacity-60"
                >
                  <RefreshCw className={["h-4 w-4", isEquipmentLoading ? "animate-spin" : ""].join(" ")} />
                  Обновить
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {equipmentKpiCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.label}
                  className={[
                    "flex h-[115px] min-w-0 rounded-none border border-slate-800/70 px-4 py-3 transition",
                    card.tone.card,
                  ].join(" ")}
                >
                  {card.downtimeDetails ? (
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div
                        className={[
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-none border border-slate-700/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                          card.tone.iconBox,
                        ].join(" ")}
                      >
                        {Icon ? <Icon className="h-6 w-6" strokeWidth={1.9} /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium leading-tight text-slate-400">{card.label}</div>
                        <div className="mt-1.5 flex min-w-0 items-end gap-3">
                          <div
                            className={[
                              "shrink-0 text-[1.9rem] font-semibold leading-none tracking-tight tabular-nums",
                              card.tone.value,
                            ].join(" ")}
                          >
                            {card.value}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1 pb-0.5 text-[0.9rem] leading-none">
                            {card.downtimeDetails.map(([label, value]) => (
                              <div key={label} className="grid grid-cols-[minmax(0,auto)_2.2rem] items-center justify-end gap-1.5">
                                <span className="truncate text-slate-500">{label}</span>
                                <span className="text-right font-medium tabular-nums text-slate-200">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div
                        className={[
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-none border border-slate-700/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                          card.tone.iconBox,
                        ].join(" ")}
                      >
                        {Icon ? <Icon className="h-6 w-6" strokeWidth={1.9} /> : null}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight text-slate-400">{card.label}</div>
                        <div
                          className={[
                            "mt-1.5 text-[1.9rem] font-semibold leading-none tracking-tight",
                            card.tone.value,
                          ].join(" ")}
                        >
                          {card.value}
                        </div>
                        {card.caption ? (
                          <div className="mt-2 text-xs leading-none text-slate-500">{card.caption}</div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 items-stretch gap-4 xl:grid-cols-5">
            <section className="glass-panel flex h-full flex-col p-4 sm:p-5 xl:col-span-3">
              <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-50">
                Расчётная загрузка оборудования по месячному плану
              </h2>

              {isEquipmentLoading ? (
                <div className="mt-5 text-sm text-slate-300">Загружаем расчётную загрузку оборудования...</div>
              ) : equipmentLoadItems.length === 0 ? (
                <div className="mt-5 rounded-none border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                  За выбранный период нет данных по загрузке оборудования.
                </div>
              ) : (
                  <div className="mt-4 flex-1 overflow-hidden rounded-none border border-cyan-300/10">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Оборудование</th>
                          <th className="px-3 py-2 text-right font-medium">Доступно, ч</th>
                          <th className="px-3 py-2 text-right font-medium">Плановая загрузка, ч</th>
                          <th className="px-3 py-2 text-right font-medium">Плановое ТО, ч</th>
                          <th className="px-3 py-2 text-right font-medium">Резерв / перегруз, ч</th>
                          <th className="px-3 py-2 text-right font-medium">Загрузка, %</th>
                          <th className="px-3 py-2 text-left font-medium">Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {equipmentLoadItems.map((item) => {
                          const displayStatus = getEquipmentLoadDisplay(item);
                          const loadPercent = Number(item.load_percent);
                          const loadBarWidth = Number.isFinite(loadPercent)
                            ? Math.max(0, Math.min(loadPercent, 100))
                            : 0;
                          const remainingHours = Number(item.remaining_hours);
                          const maintenanceHours = Number(item.planned_maintenance_hours ?? 0);

                          return (
                            <tr
                              key={`${item.equipment_id}-${item.equipment_code}`}
                              className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]"
                            >
                              <td className="px-3 py-2.5 text-slate-300">
                                <div className="flex flex-col">
                                  <span className="font-medium text-slate-100">{item.equipment_name}</span>
                                  <span className="text-xs text-slate-500">{item.equipment_code}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-200">
                                {formatHours(item.available_hours)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-200">
                                {item.planned_load_hours === null ? "—" : formatHours(item.planned_load_hours)}
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-200">
                                {formatHours(maintenanceHours)}
                              </td>
                              <td
                                className={[
                                  "px-3 py-2.5 text-right font-medium",
                                  remainingHours > 0
                                    ? "text-emerald-300"
                                    : remainingHours < 0
                                      ? "text-rose-300"
                                      : "text-slate-200",
                                ].join(" ")}
                              >
                                {formatHours(item.remaining_hours)}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex min-w-[92px] flex-col items-end gap-1">
                                  <span
                                    className={[
                                      "font-medium",
                                      displayStatus.status === "overloaded"
                                        ? "text-rose-300"
                                        : displayStatus.status === "high_load"
                                          ? "text-amber-300"
                                          : displayStatus.status === "no_load"
                                            ? "text-slate-300"
                                            : "text-slate-200",
                                    ].join(" ")}
                                  >
                                    {item.load_percent === null ? "—" : formatPercent(item.load_percent)}
                                  </span>
                                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                                    <span
                                      className={[
                                        "block h-full rounded-full transition-all",
                                        getEquipmentLoadBarTone(displayStatus.status, item.load_percent),
                                      ].join(" ")}
                                      style={{ width: `${loadBarWidth}%` }}
                                    />
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex flex-col gap-1">
                                  <span
                                    className={[
                                      "inline-flex w-fit items-center rounded-none border px-2.5 py-1 text-xs font-medium",
                                      getEquipmentStatusTone(displayStatus.status),
                                    ].join(" ")}
                                  >
                                    {displayStatus.status_label}
                                  </span>
                                  {item.warning ? (
                                    <span className="text-xs text-slate-500">{item.warning}</span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            <>
              <section className="glass-panel flex h-full flex-col p-4 sm:p-5 xl:col-span-2">
                <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-50">
                  Внеплановые простои по категориям
                </h2>

                {isEquipmentLoading ? (
                  <div className="mt-5 text-sm text-slate-300">Загружаем категории внеплановых простоев...</div>
                ) : downtimeCategoryItems.length === 0 ? (
                  <div className="mt-5 rounded-none border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                    За выбранный период внеплановые простои по категориям не зарегистрированы.
                  </div>
                ) : (
                  <div className="mt-4 flex-1 overflow-hidden rounded-none border border-cyan-300/10">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Категория</th>
                            <th className="px-3 py-2 text-right font-medium">Кол-во простоев</th>
                            <th className="px-3 py-2 text-right font-medium">Время, ч</th>
                            <th className="px-3 py-2 text-right font-medium">Доля, %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {downtimeCategoryItems.map((item) => {
                            const sharePercent = Number(item.share_percent ?? 0);
                            const shareWidth = Number.isFinite(sharePercent)
                              ? Math.max(0, Math.min(sharePercent, 100))
                              : 0;

                            return (
                              <tr
                                key={item.category}
                                className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]"
                              >
                                <td className="px-3 py-2.5 text-slate-100">{item.category}</td>
                                <td className="px-3 py-2.5 text-right text-slate-200">{item.downtime_count}</td>
                                <td className="px-3 py-2.5 text-right text-slate-200">
                                  {formatHours(item.downtime_hours)}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <div className="flex min-w-[108px] flex-col items-end gap-1">
                                    <span className="font-medium text-slate-200">
                                      {formatPercent(item.share_percent)}
                                    </span>
                                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                                      <span
                                        className="block h-full rounded-full bg-cyan-400/75 transition-all"
                                        style={{ width: `${shareWidth}%` }}
                                      />
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            </>
          </div>

          <section className="glass-panel mt-4 p-4 sm:p-5">
            <h2 className="text-[1.35rem] font-semibold tracking-tight text-slate-50">
              Детализация внеплановых простоев
            </h2>

            {isEquipmentLoading ? (
              <div className="mt-5 text-sm text-slate-300">Загружаем простои оборудования...</div>
            ) : downtimeItems.length === 0 ? (
              <div className="mt-5 rounded-none border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-400">
                За выбранный период внеплановые простои не зарегистрированы.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10">
                <div className="max-h-[430px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Оборудование</th>
                        <th className="px-3 py-2 text-left font-medium">Причина</th>
                        <th className="px-3 py-2 text-left font-medium">Категория</th>
                        <th className="px-3 py-2 text-right font-medium">Кол-во</th>
                        <th className="px-3 py-2 text-right font-medium">Время, ч</th>
                      </tr>
                    </thead>
                    <tbody>
                      {downtimeItems.map((item) => (
                        <tr
                          key={`${item.equipment_id}-${item.reason_id}`}
                          className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]"
                        >
                          <td className="px-3 py-2.5 text-slate-300">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-100">{item.equipment_name}</span>
                              <span className="text-xs text-slate-500">{item.equipment_code}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-300">
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-100">{item.reason_name}</span>
                              {item.reason_code ? (
                                <span className="text-xs text-slate-500">{item.reason_code}</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-200">{item.reason_category}</td>
                          <td className="px-3 py-2.5 text-right text-slate-200">
                            {item.downtime_count}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-200">
                            {formatHours(item.downtime_hours)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

        </div>
      )}
    </section>
  );
}

export default ProductionAnalyticsSection;
