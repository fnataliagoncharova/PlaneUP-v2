import { RefreshCw, Trash2 } from "lucide-react";
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

function normalizeIntegerInput(value) {
  const raw = String(value).replace(/\s+/g, "");
  const decimalSeparatorIndex = raw.search(/[.,]/);
  const integerPart = decimalSeparatorIndex >= 0 ? raw.slice(0, decimalSeparatorIndex) : raw;
  return integerPart.replace(/\D/g, "");
}

function getWarningLineClassName(lineText, lineIndex, previousLineText = "") {
  const normalizedLine = String(lineText || "");
  const trimmedLine = normalizedLine.trimStart();
  const previousTrimmedLine = String(previousLineText || "").trimStart();

  if (!trimmedLine) {
    const isAfterComponentLine =
      previousTrimmedLine.startsWith("Компонент:") || previousTrimmedLine.startsWith("Компонент ");
    return isAfterComponentLine ? "h-2 whitespace-pre-wrap" : "h-3 whitespace-pre-wrap";
  }

  const isComponentLine = trimmedLine.startsWith("Компонент:") || trimmedLine.startsWith("Компонент ");
  const isRequiredLine = trimmedLine.startsWith("Требуется:");
  const isAvailableNowLine = trimmedLine.startsWith("Доступно на текущую дату:");
  const isShortageLine =
    trimmedLine.startsWith("Дефицит доступного компонента:") || trimmedLine.startsWith("Дефицит компонента:");
  const isDegassingLine = trimmedLine.startsWith("В дегазации:");
  const isDegassingBatchLine = previousTrimmedLine.startsWith("В дегазации:");

  if (isComponentLine) {
    return [
      "whitespace-pre-wrap font-semibold text-slate-100",
      lineIndex > 0 ? "mt-1" : "",
    ]
      .join(" ")
      .trim();
  }

  if (isShortageLine) {
    return "whitespace-pre-wrap ml-4 font-medium text-amber-200";
  }

  if (isDegassingLine) {
    return "whitespace-pre-wrap ml-4 font-medium text-cyan-200";
  }

  if (isRequiredLine || isAvailableNowLine) {
    return "whitespace-pre-wrap ml-4 text-slate-300";
  }

  if (isDegassingBatchLine) {
    return "whitespace-pre-wrap ml-6 text-slate-300";
  }

  return "whitespace-pre-wrap text-slate-300";
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
  const [commentModalState, setCommentModalState] = useState({
    isOpen: false,
    rowKey: "",
    value: "",
  });

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
        const weekActualQty = weekLine ? asNumber(weekLine.actual_qty) : 0;
        const weekRemainingToProduceQty = weekLine ? asNumber(weekLine.remaining_to_produce_qty) : 0;
        const weekOverproductionQty = weekLine ? asNumber(weekLine.overproduction_qty) : 0;
        const monthlyActualQty = weekLine ? asNumber(weekLine.monthly_actual_qty) : asNumber(planLine.actual_qty);
        const monthlyRemainingToProduceQty = weekLine
          ? asNumber(weekLine.monthly_remaining_to_produce_qty)
          : asNumber(planLine.remaining_to_produce_qty);
        const monthlyOverproductionQty = weekLine
          ? asNumber(weekLine.monthly_overproduction_qty)
          : asNumber(planLine.overproduction_qty);
        const isPlannedInWeek = Boolean(weekLine) || currentWeekQty > 0;
        const rawSequence = Number(weekLine?.sequence_no);
        const weekSequenceNo = Number.isFinite(rawSequence) && rawSequence > 0 ? rawSequence : null;
        return {
          ...planLine,
          row_key: String(lineId),
          week_line: weekLine || null,
          month_qty: monthQty,
          distributed_qty: distributedQty,
          remaining_qty: monthQty - distributedQty,
          current_week_qty: currentWeekQty,
          week_actual_qty: weekActualQty,
          week_remaining_to_produce_qty: weekRemainingToProduceQty,
          week_overproduction_qty: weekOverproductionQty,
          monthly_actual_qty: monthlyActualQty,
          monthly_remaining_to_produce_qty: monthlyRemainingToProduceQty,
          monthly_overproduction_qty: monthlyOverproductionQty,
          initial_sequence: weekLine?.sequence_no || index + 1,
          is_planned_in_week: isPlannedInWeek,
          week_sequence_no: weekSequenceNo,
        };
      })
      .sort((a, b) => {
        if (Boolean(a.is_planned_in_week) !== Boolean(b.is_planned_in_week)) {
          return a.is_planned_in_week ? -1 : 1;
        }

        if (a.is_planned_in_week && b.is_planned_in_week) {
          const aHasSequence = Number.isFinite(a.week_sequence_no);
          const bHasSequence = Number.isFinite(b.week_sequence_no);
          if (aHasSequence && bHasSequence && a.week_sequence_no !== b.week_sequence_no) {
            return a.week_sequence_no - b.week_sequence_no;
          }
        }

        return String(a.nomenclature_code || "").localeCompare(String(b.nomenclature_code || ""), "ru");
      });
  }, [distributedTotals, selectedPlan, selectedWeek]);

  useEffect(() => {
    const nextEdits = {};
    tableRows.forEach((row) => {
      const options = equipmentByPlanLine[row.row_key] || [];
      const defaultOption = options.find((item) => item.equipment_role === "primary") || options[0];
      const parsedPlannedQty = Number.parseInt(normalizeIntegerInput(String(row.week_line?.planned_qty ?? "")), 10);
      nextEdits[row.row_key] = {
        planned_qty: row.week_line && Number.isFinite(parsedPlannedQty) && parsedPlannedQty > 0 ? formatNumber(parsedPlannedQty) : "",
        route_step_equipment_id: row.week_line?.route_step_equipment_id
          ? String(row.week_line.route_step_equipment_id)
          : defaultOption
            ? String(defaultOption.step_equipment_id)
            : "",
        sequence_no: row.week_line?.sequence_no != null ? String(row.week_line.sequence_no) : "",
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

  const openCommentModal = (rowKey) => {
    const currentComment = rowEdits[rowKey]?.comment || "";
    setCommentModalState({
      isOpen: true,
      rowKey: String(rowKey),
      value: currentComment,
    });
  };

  const closeCommentModal = () => {
    setCommentModalState({
      isOpen: false,
      rowKey: "",
      value: "",
    });
  };

  const applyCommentModal = () => {
    if (commentModalState.rowKey) {
      handleEditRow(commentModalState.rowKey, "comment", commentModalState.value);
    }
    closeCommentModal();
  };

  const handleWeekQtyBlur = (rowKey) => {
    const rawValue = rowEdits[rowKey]?.planned_qty ?? "";
    const normalized = normalizeIntegerInput(rawValue);
    if (!normalized) {
      return;
    }
    const numberValue = Number.parseInt(normalized, 10);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return;
    }
    handleEditRow(rowKey, "planned_qty", formatNumber(numberValue));
  };

  const getSelectedEquipment = (rowKey, selectedId) =>
    (equipmentByPlanLine[rowKey] || []).find((option) => String(option.step_equipment_id) === String(selectedId || ""));

  const getDraftDistributionPreview = (row, edit) => {
    const monthlyPlannedQty = asNumber(row.month_qty);
    const alreadyPlannedQty = asNumber(row.distributed_qty);
    const currentWeekQty = asNumber(row.current_week_qty);
    const draftWeekQty = asNumber(edit?.planned_qty);
    const otherWeeksDistributedQty = alreadyPlannedQty - currentWeekQty;
    const draftDistributedQty = otherWeeksDistributedQty + draftWeekQty;
    const draftRemainingToDistributeQtyRaw = monthlyPlannedQty - draftDistributedQty;
    const draftRemainingToDistributeQty = Math.max(draftRemainingToDistributeQtyRaw, 0);
    const draftOverdistributedQty = Math.max(draftDistributedQty - monthlyPlannedQty, 0);
    return {
      draftWeekQty,
      draftDistributedQty,
      draftRemainingToDistributeQty,
      draftOverdistributedQty,
    };
  };

  const getRowWarnings = (row, edit) => {
    const warnings = [...(row.week_line?.warnings || [])];
    const { draftWeekQty, draftOverdistributedQty } = getDraftDistributionPreview(row, edit);
    const qty = draftWeekQty;
    const selectedEquipment = getSelectedEquipment(row.row_key, edit?.route_step_equipment_id);
    const minBatch = asNumber(selectedEquipment?.min_batch_qty);
    const monthlyQty = asNumber(row.month_qty);
    const allowedQty = asNumber(row.remaining_qty) + asNumber(row.current_week_qty);
    if (qty > 0 && !edit?.route_step_equipment_id) {
      warnings.push("Оборудование не выбрано.");
    }
    if (qty > monthlyQty) {
      warnings.push("План недели больше объёма месячного плана по позиции.");
    }
    if (qty > allowedQty || draftOverdistributedQty > 0) {
      warnings.push("Нельзя распределить больше утверждённого месячного плана. Увеличьте месячный план и утвердите его заново.");
    }
    if (qty > 0 && minBatch > 0 && qty < minBatch) {
      warnings.push("План недели меньше минимальной партии для выбранного оборудования.");
    }
    return Array.from(new Set(warnings));
  };

  const isSelectedWeekPersisted = Boolean(selectedMergedWeek?.production_plan_week_id);
  const selectedWeekStatusLabel = useMemo(() => {
    if (!isSelectedWeekPersisted) {
      return "Не сохранена";
    }
    const rawStatus = selectedWeek?.status || selectedMergedWeek?.status || "draft";
    if (String(rawStatus).toLowerCase() === "draft") {
      return "Черновик";
    }
    return rawStatus;
  }, [isSelectedWeekPersisted, selectedMergedWeek?.status, selectedWeek?.status]);

  const weekWarnings = useMemo(() => {
    const uniqueWarnings = new Map();

    tableRows.forEach((row) => {
      const edit = rowEdits[row.row_key] || {};
      const rowWarnings = getRowWarnings(row, edit);
      rowWarnings.forEach((warningText) => {
        const warningKey = `${row.nomenclature_code || "—"}::${warningText}`;
        if (!uniqueWarnings.has(warningKey)) {
          uniqueWarnings.set(warningKey, {
            warningKey,
            nomenclatureCode: row.nomenclature_code || "—",
            warningText,
          });
        }
      });
    });

    return Array.from(uniqueWarnings.values());
  }, [equipmentByPlanLine, rowEdits, tableRows]);

  const hasDraftOverdistribution = useMemo(
    () =>
      tableRows.some((row) => {
        const edit = rowEdits[row.row_key] || {};
        const draftDistribution = getDraftDistributionPreview(row, edit);
        return draftDistribution.draftOverdistributedQty > 0;
      }),
    [rowEdits, tableRows],
  );

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
        const qty = Number.parseInt(normalizeIntegerInput(edit?.planned_qty || ""), 10) || 0;
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
      await loadWeekDetails(weekId);
      setSuccessText("План недели сохранён.");
    } catch (error) {
      setErrorText(toErrorMessage(error, "Не удалось сохранить план недели."));
      try {
        if (selectedPlanId) {
          const planId = Number(selectedPlanId);
          await loadWeeks(planId);
          await syncSelectedWeekDetails();
        }
      } catch {
        // keep original error visible; refresh failure should not mask it
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWeek = async () => {
    if (!weekDeleteCandidate || !selectedPlanId) {
      return;
    }
    const deleteCandidate = weekDeleteCandidate;
    const currentPlanId = Number(selectedPlanId);
    setIsDeleting(true);
    setWeekDeleteCandidate(null);
    try {
      await deleteProductionWeekPlan(deleteCandidate.production_plan_week_id);
      await loadWeeks(currentPlanId);
      await syncSelectedWeekDetails();
      setSuccessText("Недельный план удалён.");
    } catch (error) {
      setErrorText(toErrorMessage(error, "Не удалось удалить неделю."));
      try {
        await loadWeeks(currentPlanId);
        await syncSelectedWeekDetails();
      } catch {
        // keep original error visible; refresh failure should not mask it
      }
    } finally {
      setIsDeleting(false);
      setWeekDeleteCandidate(null);
    }
  };

  const isSaveDisabled = !selectedMergedWeek || !selectedPlan || isSaving || isLoading || hasDraftOverdistribution;

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

            <div className="min-w-[170px]">
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Статус недели</div>
              <div className="inline-flex h-11 w-full items-center rounded-none border border-cyan-300/20 bg-cyan-400/[0.08] px-3 text-sm font-medium text-cyan-100">
                {selectedWeekStatusLabel}
              </div>
            </div>

            <button type="button" onClick={handleSaveWeekPlan} disabled={isSaveDisabled} className="h-11 rounded-none border border-cyan-300/35 bg-cyan-400/[0.18] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.28] disabled:opacity-50">
              {isSaving ? "Сохраняем..." : "Сохранить план недели"}
            </button>
            <button type="button" onClick={handleRefresh} disabled={isLoading || isSaving} className="inline-flex h-11 items-center gap-2 rounded-none border border-white/12 px-4 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-50">
              <RefreshCw className={["h-4 w-4", isLoading ? "animate-spin" : ""].join(" ")} />
              Обновить
            </button>
            {isSelectedWeekPersisted ? (
              <button
                type="button"
                onClick={() => setWeekDeleteCandidate(selectedMergedWeek)}
                disabled={isDeleting || isLoading || isSaving}
                className="inline-flex h-11 items-center gap-2 rounded-none border border-rose-300/30 bg-rose-500/[0.1] px-4 text-sm text-rose-100 transition hover:bg-rose-500/[0.15] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Удалить неделю
              </button>
            ) : null}
          </div>
        )}
      </section>

      {successText ? <div className="glass-panel border-emerald-300/30 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-100">{successText}</div> : null}
      {errorText ? <div className="glass-panel border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">{errorText}</div> : null}
      {hasDraftOverdistribution ? (
        <div className="glass-panel border-amber-300/35 bg-amber-500/[0.12] px-4 py-3 text-sm text-amber-100">
          Нельзя распределить больше утверждённого месячного плана. Увеличьте месячный план и утвердите его заново.
        </div>
      ) : null}

      {hasApprovedPlans ? (
        <div className="space-y-5">
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
      <th colSpan={2} className="px-3 py-1.5 text-left font-medium text-slate-400">Позиция</th>
      <th colSpan={2} className="border-l border-cyan-300/10 bg-cyan-400/[0.03] px-3 py-1.5 text-left font-medium text-slate-400">Месяц</th>
      <th colSpan={4} className="border-l border-cyan-300/10 bg-white/[0.02] px-3 py-1.5 text-left font-medium text-slate-400">Распределение</th>
      <th colSpan={3} className="border-l border-cyan-300/10 px-3 py-1.5 text-left font-medium text-slate-400">Параметры запуска</th>
      <th colSpan={1} className="border-l border-cyan-300/10 px-3 py-1.5 text-left font-medium text-slate-400">Риски</th>
    </tr>
    <tr>
      <th className="px-3 py-2 text-left font-medium">Код</th>
      <th className="px-3 py-2 text-left font-medium">Номенклатура</th>
      <th className="border-l border-cyan-300/10 bg-cyan-400/[0.03] px-3 py-2 text-right font-medium">План месяца</th>
      <th className="bg-cyan-400/[0.03] px-3 py-2 text-right font-medium">Факт месяца</th>
      <th className="border-l border-cyan-300/10 bg-white/[0.02] px-3 py-2 text-right font-medium">Распределено</th>
      <th className="bg-white/[0.02] px-3 py-2 text-right font-medium">Осталось распределить</th>
      <th className="bg-white/[0.02] px-3 py-2 text-right font-medium">План недели</th>
      <th className="bg-white/[0.02] px-3 py-2 text-right font-medium">Факт недели</th>
      <th className="border-l border-cyan-300/10 px-3 py-2 text-right font-medium">Очер.</th>
      <th className="px-3 py-2 text-left font-medium">Оборудование</th>
      <th className="px-3 py-2 text-left font-medium">Комм.</th>
      <th className="border-l border-cyan-300/10 px-3 py-2 text-center font-medium">Риски</th>
    </tr>
  </thead>
  <tbody>
    {tableRows.map((row) => {
      const edit = rowEdits[row.row_key] || {};
      const draftDistribution = getDraftDistributionPreview(row, edit);
      const warnings = getRowWarnings(row, edit);
      const hasWeekActual = row.week_actual_qty > 0;
      const hasMonthlyActual = row.monthly_actual_qty > 0;
      const hasWeekOverproduction = row.week_overproduction_qty > 0;
      const hasDraftOverdistributed = draftDistribution.draftOverdistributedQty > 0;
      return (
        <tr key={row.production_plan_line_id} className={["border-t border-white/[0.05] hover:bg-cyan-300/[0.03]", row.is_priority ? "bg-amber-400/[0.03]" : ""].join(" ")}>
          <td className="px-3 py-2.5 font-medium text-slate-100">{row.nomenclature_code}</td>
          <td className="px-3 py-2.5 text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              {row.nomenclature_name}
              <span className="text-slate-500">({row.unit_of_measure || "—"})</span>
              {row.is_priority ? <span className="text-amber-200" title={row.priority_note || "Приоритетная позиция"}>★</span> : null}
            </span>
          </td>
          <td className="border-l border-cyan-300/10 bg-cyan-400/[0.03] px-3 py-2.5 text-right tabular-nums text-slate-200">{formatNumber(row.month_qty)}</td>
          <td className="bg-cyan-400/[0.03] px-3 py-2.5 text-right tabular-nums text-slate-100">
            {hasMonthlyActual ? formatNumber(row.monthly_actual_qty) : <span className="text-slate-500">—</span>}
          </td>
          <td className="border-l border-cyan-300/10 bg-white/[0.02] px-3 py-2.5 text-right tabular-nums text-slate-200">{formatNumber(draftDistribution.draftDistributedQty)}</td>
          <td className="bg-white/[0.02] px-3 py-2.5 text-right tabular-nums font-semibold text-slate-100">
            <div className="flex flex-col items-end gap-0.5 leading-tight">
              <span>{formatNumber(draftDistribution.draftRemainingToDistributeQty)}</span>
              {hasDraftOverdistributed ? <span className="text-[11px] text-amber-100">Превышение: {formatNumber(draftDistribution.draftOverdistributedQty)}</span> : null}
            </div>
          </td>
          <td className="bg-white/[0.02] px-3 py-2.5">
            <input
              type="text"
              inputMode="numeric"
              value={edit.planned_qty || ""}
              onChange={(event) => handleEditRow(row.row_key, "planned_qty", normalizeIntegerInput(event.target.value))}
              onBlur={() => handleWeekQtyBlur(row.row_key)}
              className="h-9 w-[92px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.7)] px-2 text-right tabular-nums text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            />
          </td>
          <td className="bg-white/[0.02] px-3 py-2.5 text-right tabular-nums text-slate-100">
            {hasWeekActual ? (
              <div className="flex flex-col items-end gap-0.5 leading-tight">
                <span>{formatNumber(row.week_actual_qty)}</span>
                {hasWeekOverproduction ? <span className="text-[11px] text-amber-100">+{formatNumber(row.week_overproduction_qty)}</span> : null}
              </div>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </td>
          <td className="border-l border-cyan-300/10 px-3 py-2.5">
            <input type="number" min="1" step="1" value={edit.sequence_no || ""} onChange={(event) => handleEditRow(row.row_key, "sequence_no", event.target.value)} className="h-9 w-[68px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.7)] px-2 text-right tabular-nums text-sm text-slate-100 outline-none focus:border-cyan-300/40" />
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
          <td className="px-3 py-2.5">
            <button
              type="button"
              onClick={() => openCommentModal(row.row_key)}
              aria-label="Комментарий"
              className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-white/[0.12] bg-[rgba(8,22,34,0.72)] text-sm text-slate-100 transition hover:border-cyan-300/40 hover:text-cyan-100"
            >
              {String(edit.comment || "").trim() ? "💬" : "+"}
            </button>
          </td>
          <td className="border-l border-cyan-300/10 px-3 py-2.5 text-center">
            {warnings.length ? (
              <span className="inline-flex items-center text-amber-100/90">⚠</span>
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

          <section className="glass-panel px-5 py-4 sm:px-6">
            <div className="text-xs tracking-[0.08em] text-slate-500">Предупреждения по неделе</div>
            <div className="mt-2 rounded-none border border-amber-300/15 bg-amber-500/[0.04] p-3">
              {weekWarnings.length ? (
                <ul className="space-y-2 text-sm text-slate-200">
                  {weekWarnings.map((warning) => (
                    <li key={warning.warningKey} className="flex items-start gap-2">
                      <span className="mt-0.5 text-amber-300">⚠</span>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-100">{warning.nomenclatureCode}</div>
                        <div className="mt-0.5">
                          {String(warning.warningText || "")
                            .split("\n")
                            .map((lineText, lineIndex, lines) => (
                              <div
                                key={`${warning.warningKey}-${lineIndex}`}
                                className={getWarningLineClassName(lineText, lineIndex, lines[lineIndex - 1] || "")}
                              >
                                {lineText || "\u00A0"}
                              </div>
                            ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-400">Предупреждений нет</div>
              )}
            </div>
          </section>

          <details className="glass-panel px-5 py-4 text-sm text-slate-300 sm:px-6">
            <summary className="cursor-pointer select-none text-slate-300 marker:text-cyan-200">ⓘ Правила планирования</summary>
            <div className="mt-3 space-y-1 text-slate-400">
              <div>Превышение месячного плана запрещено.</div>
              <div>Минимальная партия — предупреждение.</div>
              <div>Оборудование можно оставить пустым.</div>
              <div>Производимые компоненты — предупреждение.</div>
            </div>
          </details>
        </div>
      ) : null}

      <V2ConfirmDialog
        open={Boolean(weekDeleteCandidate)}
        title="Удалить недельный план?"
        message="Будут удалены сохранённые строки выбранной недели. Месячный план не изменится."
        confirmText={isDeleting ? "Удаляем..." : "Удалить"}
        cancelText="Отмена"
        onConfirm={handleDeleteWeek}
        onCancel={() => setWeekDeleteCandidate(null)}
        isConfirmDisabled={isDeleting}
        isCancelDisabled={isDeleting}
      />

      {commentModalState.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-none border border-cyan-300/20 bg-[rgba(10,24,36,0.98)] p-5 shadow-[0_22px_80px_rgba(6,10,14,0.65)]">
            <div className="text-lg font-semibold text-slate-50">Комментарий</div>
            <textarea
              value={commentModalState.value}
              onChange={(event) =>
                setCommentModalState((prev) => ({
                  ...prev,
                  value: event.target.value,
                }))
              }
              rows={6}
              className="mt-4 w-full rounded-none border border-white/[0.12] bg-[rgba(8,22,34,0.82)] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCommentModal}
                className="h-9 rounded-none border border-white/15 px-4 text-sm text-slate-200 transition hover:border-cyan-300/30"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={applyCommentModal}
                className="h-9 rounded-none border border-cyan-300/35 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.24]"
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default WeeklyPlanningPanel;

