import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import V2ConfirmDialog from "../common/V2ConfirmDialog";
import { getMachinesList } from "../../services/machinesApi";
import {
  addProductionWeekLine,
  createProductionPlanWeek,
  deleteProductionWeekLine,
  deleteProductionWeekPlan,
  getProductionPlan,
  getProductionPlans,
  getProductionPlanWeeks,
  getProductionWeekPlan,
  updateProductionWeekLine,
} from "../../services/productionPlansApi";
import { getRouteStepEquipmentList } from "../../services/routeStepEquipmentApi";
import { getRouteStepsList } from "../../services/routeStepsApi";
import { getRoutesList } from "../../services/routesApi";

function toErrorMessage(error, fallbackText) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackText;
}

function formatPlanMonth(value) {
  return value ? String(value).slice(0, 7) : "—";
}

function formatDate(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("ru-RU");
}

function formatWeekOption(week) {
  return `Неделя ${week.week_no} · ${formatDate(week.week_start_date)}–${formatDate(week.week_end_date)}`;
}

function asNumber(value) {
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(number);
}

function normalizeNumericInput(value) {
  return String(value).replace(/[^\d.,\s-]/g, "");
}

function buildSystemWeeks(planMonthValue) {
  if (!planMonthValue) {
    return [];
  }
  const [yearRaw, monthRaw] = String(planMonthValue).slice(0, 7).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [];
  }
  const lastDay = new Date(year, month, 0).getDate();
  const pad = (day) => String(day).padStart(2, "0");
  const iso = (day) => `${year}-${String(month).padStart(2, "0")}-${pad(day)}`;
  return [
    { week_no: 1, week_start_date: iso(1), week_end_date: iso(7) },
    { week_no: 2, week_start_date: iso(8), week_end_date: iso(14) },
    { week_no: 3, week_start_date: iso(15), week_end_date: iso(21) },
    { week_no: 4, week_start_date: iso(22), week_end_date: iso(lastDay) },
  ];
}

function WeeklyPlanningPanel() {
  const [approvedPlans, setApprovedPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [dbWeeks, setDbWeeks] = useState([]);
  const [selectedSystemWeekNo, setSelectedSystemWeekNo] = useState("1");
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [distributedTotals, setDistributedTotals] = useState({});
  const [equipmentByPlanLine, setEquipmentByPlanLine] = useState({});
  const [rowEdits, setRowEdits] = useState({});

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [weekDeleteCandidate, setWeekDeleteCandidate] = useState(null);

  const hasApprovedPlans = approvedPlans.length > 0;

  const loadPlanDetails = useCallback(async (planId) => {
    if (!planId) {
      setSelectedPlan(null);
      return null;
    }
    const plan = await getProductionPlan(planId);
    setSelectedPlan(plan);
    return plan;
  }, []);

  const loadWeekDetails = useCallback(async (weekId) => {
    if (!weekId) {
      setSelectedWeek(null);
      return null;
    }
    const week = await getProductionWeekPlan(weekId);
    setSelectedWeek(week);
    return week;
  }, []);

  const loadDistributedTotals = useCallback(async (weekList) => {
    if (!weekList.length) {
      setDistributedTotals({});
      return;
    }
    const detailList = await Promise.all(weekList.map((week) => getProductionWeekPlan(week.production_plan_week_id)));
    const totals = {};
    detailList.forEach((week) => {
      (week.lines || []).forEach((line) => {
        const key = String(line.production_plan_line_id);
        totals[key] = (totals[key] || 0) + asNumber(line.planned_qty);
      });
    });
    setDistributedTotals(totals);
  }, []);

  const loadEquipmentOptions = useCallback(async (plan) => {
    if (!plan?.lines?.length) {
      setEquipmentByPlanLine({});
      return;
    }
    try {
      const [routes, machines] = await Promise.all([getRoutesList(), getMachinesList()]);
      const activeRoutes = (routes || []).filter((route) => route.is_active);
      const stepsByRouteId = {};
      await Promise.all(
        activeRoutes.map(async (route) => {
          try {
            stepsByRouteId[route.route_id] = await getRouteStepsList(route.route_id);
          } catch {
            stepsByRouteId[route.route_id] = [];
          }
        }),
      );
      const machineMap = new Map((machines || []).map((machine) => [Number(machine.machine_id), machine]));
      const byPlanLine = {};

      for (const line of plan.lines) {
        const lineKey = String(line.production_plan_line_id);
        const nomenclatureId = Number(line.nomenclature_id);
        const preferredRoute = activeRoutes.find((item) => Number(item.result_nomenclature_id) === nomenclatureId);
        let targetStep = null;

        if (preferredRoute) {
          targetStep = [...(stepsByRouteId[preferredRoute.route_id] || [])]
            .filter((step) => Number(step.output_nomenclature_id) === nomenclatureId)
            .sort((a, b) => Number(b.step_no) - Number(a.step_no))[0];
        }

        if (!targetStep) {
          const fallbackCandidates = [];
          activeRoutes.forEach((route) => {
            (stepsByRouteId[route.route_id] || []).forEach((step) => {
              if (Number(step.output_nomenclature_id) === nomenclatureId) {
                fallbackCandidates.push({ step });
              }
            });
          });
          targetStep = fallbackCandidates
            .sort((a, b) => Number(b.step.step_no) - Number(a.step.step_no))
            .map((item) => item.step)[0] || null;
        }

        if (!targetStep) {
          byPlanLine[lineKey] = [];
          continue;
        }

        const equipment = await getRouteStepEquipmentList(targetStep.route_step_id);
        byPlanLine[lineKey] = (equipment || []).map((eq) => {
          const machine = machineMap.get(Number(eq.machine_id));
          return {
            step_equipment_id: Number(eq.step_equipment_id),
            machine_name: machine?.machine_name || "Оборудование",
            equipment_role: eq.equipment_role,
            min_batch_qty: eq.min_batch_qty,
          };
        });
      }

      setEquipmentByPlanLine(byPlanLine);
    } catch {
      setEquipmentByPlanLine({});
    }
  }, []);

  const systemWeeks = useMemo(() => buildSystemWeeks(selectedPlan?.plan_month), [selectedPlan?.plan_month]);

  const mergedWeeks = useMemo(() => {
    if (!systemWeeks.length) {
      return [];
    }
    const dbByNo = new Map(dbWeeks.map((item) => [Number(item.week_no), item]));
    return systemWeeks.map((week) => {
      const dbWeek = dbByNo.get(Number(week.week_no));
      return {
        ...week,
        production_plan_week_id: dbWeek?.production_plan_week_id || null,
        status: dbWeek?.status || "draft",
      };
    });
  }, [dbWeeks, systemWeeks]);

  const selectedMergedWeek = useMemo(
    () => mergedWeeks.find((week) => String(week.week_no) === String(selectedSystemWeekNo)) || null,
    [mergedWeeks, selectedSystemWeekNo],
  );

  const loadWeeks = useCallback(
    async (planId) => {
      if (!planId) {
        setDbWeeks([]);
        setSelectedWeek(null);
        setDistributedTotals({});
        return;
      }
      const list = await getProductionPlanWeeks(planId);
      setDbWeeks(list);
      await loadDistributedTotals(list);
    },
    [loadDistributedTotals],
  );

  const syncSelectedWeekDetails = useCallback(async () => {
    if (selectedMergedWeek?.production_plan_week_id) {
      await loadWeekDetails(selectedMergedWeek.production_plan_week_id);
    } else {
      setSelectedWeek(null);
    }
  }, [loadWeekDetails, selectedMergedWeek]);

  const loadApprovedPlans = useCallback(
    async (preferredPlanId = null) => {
      setIsLoading(true);
      setErrorText("");
      try {
        const plans = await getProductionPlans();
        const approved = (Array.isArray(plans) ? plans : []).filter((plan) => plan.status === "approved");
        setApprovedPlans(approved);
        if (!approved.length) {
          setSelectedPlanId("");
          setSelectedPlan(null);
          setDbWeeks([]);
          setSelectedWeek(null);
          setDistributedTotals({});
          return;
        }

        const preferredId = preferredPlanId ? Number(preferredPlanId) : null;
        const currentId = selectedPlanId ? Number(selectedPlanId) : null;
        const hasPreferred = preferredId ? approved.some((plan) => Number(plan.production_plan_id) === preferredId) : false;
        const hasCurrent = currentId ? approved.some((plan) => Number(plan.production_plan_id) === currentId) : false;
        const nextId = hasPreferred ? preferredId : hasCurrent ? currentId : Number(approved[0].production_plan_id);

        setSelectedPlanId(String(nextId));
        const plan = await loadPlanDetails(nextId);
        await loadEquipmentOptions(plan);
        await loadWeeks(nextId);
      } catch (error) {
        setErrorText(toErrorMessage(error, "Не удалось загрузить данные недельного планирования."));
      } finally {
        setIsLoading(false);
      }
    },
    [loadEquipmentOptions, loadPlanDetails, loadWeeks, selectedPlanId],
  );

  useEffect(() => {
    loadApprovedPlans();
  }, [loadApprovedPlans]);

  useEffect(() => {
    if (!systemWeeks.length) {
      setSelectedSystemWeekNo("1");
      return;
    }
    const hasSelected = systemWeeks.some((week) => String(week.week_no) === String(selectedSystemWeekNo));
    if (!hasSelected) {
      setSelectedSystemWeekNo(String(systemWeeks[0].week_no));
    }
  }, [selectedSystemWeekNo, systemWeeks]);

  useEffect(() => {
    syncSelectedWeekDetails();
  }, [syncSelectedWeekDetails]);

  const tableRows = useMemo(() => {
    if (!selectedPlan?.lines?.length) {
      return [];
    }
    const weeklyMap = new Map((selectedWeek?.lines || []).map((line) => [Number(line.production_plan_line_id), line]));
    return [...selectedPlan.lines]
      .map((planLine, index) => {
        const lineId = Number(planLine.production_plan_line_id);
        const weekLine = weeklyMap.get(lineId);
        const monthQty = asNumber(planLine.planned_qty);
        const distributedQty = asNumber(distributedTotals[String(lineId)]);
        const currentWeekQty = weekLine ? asNumber(weekLine.planned_qty) : 0;
        return {
          ...planLine,
          row_key: String(lineId),
          week_line: weekLine || null,
          month_qty: monthQty,
          distributed_qty: distributedQty,
          remaining_qty: monthQty - (distributedQty - currentWeekQty),
          initial_sequence: weekLine?.sequence_no || index + 1,
        };
      })
      .sort((a, b) => {
        if (Boolean(a.is_priority) !== Boolean(b.is_priority)) {
          return a.is_priority ? -1 : 1;
        }
        return String(a.nomenclature_code || "").localeCompare(String(b.nomenclature_code || ""), "ru");
      });
  }, [distributedTotals, selectedPlan, selectedWeek]);

  useEffect(() => {
    const nextEdits = {};
    tableRows.forEach((row) => {
      const options = equipmentByPlanLine[row.row_key] || [];
      const defaultOption = options.find((item) => item.equipment_role === "primary") || options[0];
      nextEdits[row.row_key] = {
        planned_qty: row.week_line ? String(row.week_line.planned_qty ?? "") : "",
        route_step_equipment_id: row.week_line?.route_step_equipment_id
          ? String(row.week_line.route_step_equipment_id)
          : defaultOption
            ? String(defaultOption.step_equipment_id)
            : "",
        sequence_no: row.week_line ? String(row.week_line.sequence_no ?? row.initial_sequence) : String(row.initial_sequence),
        comment: row.week_line?.comment || "",
      };
    });
    setRowEdits(nextEdits);
  }, [equipmentByPlanLine, tableRows]);

  const handleSelectPlan = async (value) => {
    setSelectedPlanId(value);
    setSuccessText("");
    setErrorText("");
    if (!value) {
      setSelectedPlan(null);
      setDbWeeks([]);
      setSelectedWeek(null);
      setEquipmentByPlanLine({});
      return;
    }
    setIsLoading(true);
    try {
      const planId = Number(value);
      const plan = await loadPlanDetails(planId);
      await loadEquipmentOptions(plan);
      await loadWeeks(planId);
    } catch (error) {
      setErrorText(toErrorMessage(error, "Не удалось переключить месячный план."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSystemWeek = (value) => {
    setSelectedSystemWeekNo(value);
    setSuccessText("");
    setErrorText("");
  };

  const handleRefresh = async () => {
    await loadApprovedPlans(selectedPlanId ? Number(selectedPlanId) : null);
  };

  const handleEditRow = (rowKey, field, value) => {
    setRowEdits((prev) => ({
      ...prev,
      [rowKey]: {
        ...prev[rowKey],
        [field]: value,
      },
    }));
  };

  const handleWeekQtyBlur = (rowKey) => {
    const rawValue = rowEdits[rowKey]?.planned_qty ?? "";
    if (!String(rawValue).trim()) {
      return;
    }
    const numberValue = asNumber(rawValue);
    if (numberValue <= 0) {
      return;
    }
    handleEditRow(rowKey, "planned_qty", formatNumber(numberValue));
  };

  const getSelectedEquipment = (rowKey, selectedId) =>
    (equipmentByPlanLine[rowKey] || []).find((option) => String(option.step_equipment_id) === String(selectedId || ""));

  const getRowWarnings = (row, edit) => {
    const warnings = [...(row.week_line?.warnings || [])];
    const qty = asNumber(edit?.planned_qty);
    const selectedEquipment = getSelectedEquipment(row.row_key, edit?.route_step_equipment_id);
    const minBatch = asNumber(selectedEquipment?.min_batch_qty);
    if (qty > 0 && !edit?.route_step_equipment_id) {
      warnings.push("Оборудование не выбрано.");
    }
    if (qty > 0 && minBatch > 0 && qty < minBatch) {
      warnings.push("План недели меньше минимальной партии для выбранного оборудования.");
    }
    return Array.from(new Set(warnings));
  };

  const ensureSelectedWeekExists = async () => {
    if (!selectedPlanId || !selectedMergedWeek) {
      throw new Error("Выберите месяц и неделю.");
    }
    if (selectedMergedWeek.production_plan_week_id) {
      return selectedMergedWeek.production_plan_week_id;
    }
    try {
      const created = await createProductionPlanWeek(Number(selectedPlanId), {
        week_no: Number(selectedMergedWeek.week_no),
        week_start_date: selectedMergedWeek.week_start_date,
        week_end_date: selectedMergedWeek.week_end_date,
        comment: null,
      });
      await loadWeeks(Number(selectedPlanId));
      return created.production_plan_week_id;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Недельный план с таким номером уже существует")) {
        await loadWeeks(Number(selectedPlanId));
        const existing = dbWeeks.find((week) => Number(week.week_no) === Number(selectedMergedWeek.week_no));
        if (existing) {
          return existing.production_plan_week_id;
        }
      }
      throw error;
    }
  };

  const handleSaveWeekPlan = async () => {
    if (!selectedPlanId || !selectedMergedWeek) {
      setErrorText("Выберите месяц и неделю для сохранения.");
      return;
    }
    setIsSaving(true);
    setErrorText("");
    setSuccessText("");
    try {
      const weekId = await ensureSelectedWeekExists();
      const existingWeek = await getProductionWeekPlan(weekId);
      const existingByPlanLine = new Map((existingWeek.lines || []).map((line) => [Number(line.production_plan_line_id), line]));

      for (const row of tableRows) {
        const edit = rowEdits[row.row_key];
        const qty = asNumber(edit?.planned_qty);
        const sequence = Math.max(1, parseInt(edit?.sequence_no || `${row.initial_sequence}`, 10) || row.initial_sequence);
        const routeStepEquipmentId = edit?.route_step_equipment_id ? Number(edit.route_step_equipment_id) : null;
        const comment = edit?.comment?.trim() || null;
        const existingLine = existingByPlanLine.get(Number(row.production_plan_line_id));

        if (qty > 0) {
          if (existingLine) {
            await updateProductionWeekLine(existingLine.production_week_line_id, {
              route_step_equipment_id: routeStepEquipmentId,
              planned_qty: qty,
              batch_count: 1,
              sequence_no: sequence,
              comment,
            });
          } else {
            await addProductionWeekLine(weekId, {
              production_plan_line_id: Number(row.production_plan_line_id),
              route_step_equipment_id: routeStepEquipmentId,
              planned_qty: qty,
              batch_count: 1,
              sequence_no: sequence,
              comment,
            });
          }
        } else if (existingLine) {
          await deleteProductionWeekLine(existingLine.production_week_line_id);
        }
      }

      const planId = Number(selectedPlanId);
      await loadPlanDetails(planId);
      await loadWeeks(planId);
      await syncSelectedWeekDetails();
      setSuccessText("План недели сохранён.");
    } catch (error) {
      setErrorText(toErrorMessage(error, "Не удалось сохранить план недели."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWeek = async () => {
    if (!weekDeleteCandidate || !selectedPlanId) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteProductionWeekPlan(weekDeleteCandidate.production_plan_week_id);
      setWeekDeleteCandidate(null);
      await loadWeeks(Number(selectedPlanId));
      await syncSelectedWeekDetails();
      setSuccessText("Недельный план удалён.");
    } catch (error) {
      setErrorText(toErrorMessage(error, "Не удалось удалить неделю."));
    } finally {
      setIsDeleting(false);
    }
  };

  const isSaveDisabled = !selectedMergedWeek || !selectedPlan || isSaving || isLoading;

  return (
    <div className="space-y-5">
      <section className="glass-panel p-5 sm:p-6">
        {!hasApprovedPlans ? (
          <div className="mt-4 text-sm text-slate-400">Нет утверждённых месячных планов. Сначала утвердите месячный план выпуска.</div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Месячный план</div>
              <select value={selectedPlanId} onChange={(event) => handleSelectPlan(event.target.value)} className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40">
                {approvedPlans.map((plan) => (
                  <option key={plan.production_plan_id} value={plan.production_plan_id}>
                    {formatPlanMonth(plan.plan_month)} — {plan.plan_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[250px] flex-1">
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Неделя</div>
              <select value={selectedSystemWeekNo} onChange={(event) => handleSelectSystemWeek(event.target.value)} disabled={!mergedWeeks.length} className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40 disabled:opacity-60">
                {!mergedWeeks.length ? (
                  <option value="">Недели недоступны.</option>
                ) : (
                  mergedWeeks.map((week) => (
                    <option key={week.week_no} value={week.week_no}>
                      {formatWeekOption(week)}
                    </option>
                  ))
                )}
              </select>
            </div>

            <button type="button" onClick={handleSaveWeekPlan} disabled={isSaveDisabled} className="h-11 rounded-none border border-cyan-300/35 bg-cyan-400/[0.18] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.28] disabled:opacity-50">
              {isSaving ? "Сохраняем..." : "Сохранить план недели"}
            </button>
            <button type="button" onClick={handleRefresh} disabled={isLoading || isSaving} className="inline-flex h-11 items-center gap-2 rounded-none border border-white/12 px-4 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-50">
              <RefreshCw className={["h-4 w-4", isLoading ? "animate-spin" : ""].join(" ")} />
              Обновить
            </button>
          </div>
        )}
      </section>

      {successText ? <div className="glass-panel border-emerald-300/30 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-100">{successText}</div> : null}
      {errorText ? <div className="glass-panel border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">{errorText}</div> : null}

      {hasApprovedPlans ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-5">
            {!selectedPlan ? null : !selectedPlan.lines?.length ? (
              <section className="glass-panel px-4 py-5 text-sm text-slate-400">В месячном плане нет позиций для распределения.</section>
            ) : (
              <section className="glass-panel p-5 sm:p-6">
                <h3 className="text-xl font-semibold tracking-tight text-slate-50">План недели</h3>
                <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10">
                  <div className="max-h-[620px] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-[11px] uppercase tracking-[0.08em] text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Код</th>
                          <th className="px-3 py-2 text-left font-medium">Номенклатура</th>
                          <th className="px-3 py-2 text-right font-medium">План месяца</th>
                          <th className="px-3 py-2 text-right font-medium">Уже распр.</th>
                          <th className="px-3 py-2 text-right font-medium">Осталось</th>
                          <th className="px-3 py-2 text-right font-medium">План нед.</th>
                          <th className="px-3 py-2 text-left font-medium">Оборудование</th>
                          <th className="px-3 py-2 text-right font-medium">Мин. партия</th>
                          <th className="px-3 py-2 text-right font-medium">Очер.</th>
                          <th className="px-3 py-2 text-left font-medium">Комментарий</th>
                          <th className="px-3 py-2 text-center font-medium">Предупреждения</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((row) => {
                          const edit = rowEdits[row.row_key] || {};
                          const warnings = getRowWarnings(row, edit);
                          const selectedEquipment = getSelectedEquipment(row.row_key, edit.route_step_equipment_id);
                          return (
                            <tr key={row.production_plan_line_id} className={["border-t border-white/[0.05] hover:bg-cyan-300/[0.03]", row.is_priority ? "bg-amber-400/[0.03]" : ""].join(" ")}>
                              <td className="px-3 py-2.5 font-medium text-slate-100">{row.nomenclature_code}</td>
                              <td className="px-3 py-2.5 text-slate-300">
                                <span className="inline-flex items-center gap-1.5">
                                  {row.nomenclature_name}
                                  {row.is_priority ? <span className="text-amber-200" title={row.priority_note || "Приоритетная позиция"}>★</span> : null}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatNumber(row.month_qty)}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatNumber(row.distributed_qty)}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatNumber(row.remaining_qty)}</td>
                              <td className="px-3 py-2.5">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={edit.planned_qty || ""}
                                  onChange={(event) => handleEditRow(row.row_key, "planned_qty", normalizeNumericInput(event.target.value))}
                                  onBlur={() => handleWeekQtyBlur(row.row_key)}
                                  className="h-9 w-[92px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.7)] px-2 text-right tabular-nums text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                                />
                              </td>
                              <td className="px-3 py-2.5">
                                <select value={edit.route_step_equipment_id || ""} onChange={(event) => handleEditRow(row.row_key, "route_step_equipment_id", event.target.value)} className="h-9 w-[130px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.7)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40">
                                  <option value="">Не выбрано</option>
                                  {(equipmentByPlanLine[row.row_key] || []).map((option) => (
                                    <option key={option.step_equipment_id} value={option.step_equipment_id}>
                                      {option.machine_name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                                {selectedEquipment?.min_batch_qty != null ? formatNumber(selectedEquipment.min_batch_qty) : "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <input type="number" min="1" step="1" value={edit.sequence_no || ""} onChange={(event) => handleEditRow(row.row_key, "sequence_no", event.target.value)} className="h-9 w-[68px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.7)] px-2 text-right tabular-nums text-sm text-slate-100 outline-none focus:border-cyan-300/40" />
                              </td>
                              <td className="px-3 py-2.5">
                                <input type="text" value={edit.comment || ""} onChange={(event) => handleEditRow(row.row_key, "comment", event.target.value)} className="h-9 w-[120px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.7)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40" />
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {warnings.length ? (
                                  <span className="inline-flex items-center text-amber-100/90" title={warnings.join("\n")}>
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </div>

          <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
            <div className="text-xs tracking-[0.08em] text-slate-500">Контекст</div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">План по неделям</h3>
            <div className="panel-divider mt-5" />
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div>Месяц: {selectedPlan ? formatPlanMonth(selectedPlan.plan_month) : "—"}</div>
              <div>Неделя: {selectedMergedWeek ? `Неделя ${selectedMergedWeek.week_no}` : "—"}</div>
              <div>Статус: {selectedWeek?.status || "draft"}</div>
            </div>
            <div className="mt-4 rounded-none border border-white/[0.08] bg-white/[0.02] p-3 text-sm text-slate-400">
              <div className="mb-2 font-medium text-slate-200">Правила:</div>
              <div>✓ Превышение месячного плана запрещено</div>
              <div>⚠ Мин. партия — предупреждение</div>
              <div>⚠ Оборудование можно оставить пустым</div>
            </div>
            {selectedMergedWeek?.production_plan_week_id ? (
              <button
                type="button"
                onClick={() => setWeekDeleteCandidate(selectedMergedWeek)}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-none border border-rose-300/30 bg-rose-500/[0.1] px-3 text-sm text-rose-100 transition hover:bg-rose-500/[0.15]"
              >
                <Trash2 className="h-4 w-4" />
                Удалить неделю
              </button>
            ) : null}
          </aside>
        </div>
      ) : null}

      <V2ConfirmDialog
        open={Boolean(weekDeleteCandidate)}
        title="Удалить недельный план?"
        message="Неделя и все её строки будут удалены. Месячный план выпуска не изменится."
        confirmText={isDeleting ? "Удаляем..." : "Удалить"}
        cancelText="Отмена"
        onConfirm={handleDeleteWeek}
        onCancel={() => setWeekDeleteCandidate(null)}
        isConfirmDisabled={isDeleting}
        isCancelDisabled={isDeleting}
      />
    </div>
  );
}

export default WeeklyPlanningPanel;
