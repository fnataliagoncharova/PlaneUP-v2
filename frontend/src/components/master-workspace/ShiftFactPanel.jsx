import { Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createProductionActual,
  deleteProductionActual,
  getProductionActuals,
  updateProductionActual,
} from "../../services/productionActualsApi";
import { getMachineItem } from "../../services/machinesApi";
import {
  getProductionPlans,
  getProductionPlanWeeks,
  getProductionWeekPlan,
} from "../../services/productionPlansApi";
import {
  getRouteStepEquipmentItem,
  getRouteStepEquipmentList,
} from "../../services/routeStepEquipmentApi";

const SHIFT_OPTIONS = [
  { value: "day", label: "День" },
  { value: "night", label: "Ночь" },
];

const TEAM_OPTIONS = ["1", "2", "3", "4"];
const SUCCESS_MESSAGE_TIMEOUT_MS = 3500;

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

function formatQty(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(number);
}

function formatMachineDisplay(machineCode, machineName) {
  const code = String(machineCode || "").trim();
  const name = String(machineName || "").trim();

  if (code && name) {
    return `${code} — ${name}`;
  }

  if (name) {
    return name;
  }

  if (code) {
    return code;
  }

  return "—";
}

function normalizeQtyInput(value) {
  return String(value).replace(/\s+/g, "").replace(",", ".");
}

function parsePositiveQty(value) {
  const normalized = normalizeQtyInput(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function normalizeInitialActualQty(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return "";
  }

  const normalized = normalizeQtyInput(rawValue);
  const parsed = Number(normalized);
  if (Number.isFinite(parsed) && parsed <= 0) {
    return "";
  }

  return rawValue;
}

function getShiftLabel(shiftType) {
  return shiftType === "night" ? "Ночь" : "День";
}

function getRemainingToProduceNumber(line) {
  const parsedValue = Number(line?.remaining_to_produce_qty);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function isWeekLineClosed(line) {
  return getRemainingToProduceNumber(line) <= 0;
}

function buildDefaultRowInput(weekStartDate) {
  return {
    actual_date: weekStartDate || "",
    route_step_equipment_id: "",
    shift_type: "",
    shift_team_no: "",
    actual_qty: "",
    comment: "",
  };
}

function buildRowInputs(lines, weekStartDate, previousInputs = {}) {
  const nextInputs = {};

  (Array.isArray(lines) ? lines : []).forEach((line) => {
    const lineKey = String(line.production_week_line_id);
    const previous = previousInputs[lineKey] || {};
    nextInputs[lineKey] = {
      actual_date: previous.actual_date || weekStartDate || "",
      route_step_equipment_id:
        previous.route_step_equipment_id !== null &&
        previous.route_step_equipment_id !== undefined &&
        String(previous.route_step_equipment_id) !== ""
          ? String(previous.route_step_equipment_id)
          : line.route_step_equipment_id !== null && line.route_step_equipment_id !== undefined
            ? String(line.route_step_equipment_id)
            : "",
      shift_type:
        previous.shift_type === "day" || previous.shift_type === "night"
          ? previous.shift_type
          : "",
      shift_team_no: TEAM_OPTIONS.includes(String(previous.shift_team_no))
        ? String(previous.shift_team_no)
        : "",
      actual_qty: normalizeInitialActualQty(previous.actual_qty),
      comment: previous.comment ?? "",
    };
  });

  return nextInputs;
}

function ShiftFactPanel() {
  const [approvedPlans, setApprovedPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [weekOptions, setWeekOptions] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState("");

  const [selectedWeek, setSelectedWeek] = useState(null);
  const [rowInputs, setRowInputs] = useState({});
  const [expandedClosedRows, setExpandedClosedRows] = useState({});
  const [equipmentOptionsByLine, setEquipmentOptionsByLine] = useState({});
  const [journalRows, setJournalRows] = useState([]);

  const [isPlansLoading, setIsPlansLoading] = useState(false);
  const [isWeeksLoading, setIsWeeksLoading] = useState(false);
  const [isWeekLoading, setIsWeekLoading] = useState(false);
  const [isJournalLoading, setIsJournalLoading] = useState(false);
  const [savingLineId, setSavingLineId] = useState(null);
  const [deletingActualId, setDeletingActualId] = useState(null);
  const [editingActualId, setEditingActualId] = useState(null);

  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");
  const [journalErrorText, setJournalErrorText] = useState("");
  const [factCommentModalState, setFactCommentModalState] = useState({
    isOpen: false,
    mode: "edit",
    lineKey: "",
    value: "",
  });
  const [taskInstructionModalState, setTaskInstructionModalState] = useState({
    isOpen: false,
    value: "",
  });
  const [factEditModalState, setFactEditModalState] = useState({
    isOpen: false,
    production_actual_id: null,
    production_week_line_id: null,
    actual_date: "",
    shift_type: "",
    shift_team_no: "",
    actual_qty: "",
    route_step_equipment_id: "",
    comment: "",
  });

  const sortedWeekLines = useMemo(() => {
    const lines = Array.isArray(selectedWeek?.lines) ? [...selectedWeek.lines] : [];
    return lines.sort((left, right) => {
      const leftGroup = getRemainingToProduceNumber(left) > 0 ? 0 : 1;
      const rightGroup = getRemainingToProduceNumber(right) > 0 ? 0 : 1;
      if (leftGroup !== rightGroup) {
        return leftGroup - rightGroup;
      }

      const leftSequence = Number(left.sequence_no || 0);
      const rightSequence = Number(right.sequence_no || 0);
      if (leftSequence !== rightSequence) {
        return leftSequence - rightSequence;
      }
      return Number(left.production_week_line_id) - Number(right.production_week_line_id);
    });
  }, [selectedWeek]);

  const loadJournal = useCallback(async (weekPayload) => {
    if (!weekPayload) {
      setJournalRows([]);
      setJournalErrorText("");
      return;
    }

    const weekLines = Array.isArray(weekPayload.lines) ? weekPayload.lines : [];
    if (weekLines.length === 0) {
      setJournalRows([]);
      setJournalErrorText("");
      return;
    }

    setIsJournalLoading(true);
    setJournalErrorText("");

    try {
      const facts = await getProductionActuals({
        date_from: weekPayload.week_start_date,
        date_to: weekPayload.week_end_date,
      });
      const weekLineIds = new Set(weekLines.map((line) => Number(line.production_week_line_id)));
      const filteredFacts = (Array.isArray(facts) ? facts : [])
        .filter((fact) => weekLineIds.has(Number(fact.production_week_line_id)))
        .sort((left, right) => {
          const dateCompare = String(right.actual_date).localeCompare(String(left.actual_date));
          if (dateCompare !== 0) {
            return dateCompare;
          }
          return Number(right.production_actual_id) - Number(left.production_actual_id);
        });
      setJournalRows(filteredFacts);
    } catch (error) {
      setJournalRows([]);
      setJournalErrorText(
        toErrorMessage(error, "Не удалось загрузить журнал выполнения."),
      );
    } finally {
      setIsJournalLoading(false);
    }
  }, []);

  const loadEquipmentOptionsForWeek = useCallback(async (weekPayload) => {
    const weekLines = Array.isArray(weekPayload?.lines) ? weekPayload.lines : [];
    if (!weekLines.length) {
      setEquipmentOptionsByLine({});
      return;
    }

    const routeStepByLineKey = {};
    await Promise.all(
      weekLines.map(async (line) => {
        const lineKey = String(line.production_week_line_id);
        const stepEquipmentId = line.route_step_equipment_id;
        if (!stepEquipmentId) {
          routeStepByLineKey[lineKey] = null;
          return;
        }

        try {
          const stepEquipment = await getRouteStepEquipmentItem(Number(stepEquipmentId));
          routeStepByLineKey[lineKey] = stepEquipment?.route_step_id
            ? Number(stepEquipment.route_step_id)
            : null;
        } catch {
          routeStepByLineKey[lineKey] = null;
        }
      }),
    );

    const rawOptionsByLine = {};
    const machineIds = new Set();

    await Promise.all(
      weekLines.map(async (line) => {
        const lineKey = String(line.production_week_line_id);
        const routeStepId = routeStepByLineKey[lineKey];
        if (!routeStepId) {
          rawOptionsByLine[lineKey] = [];
          return;
        }

        try {
          const list = await getRouteStepEquipmentList(routeStepId);
          const options = (Array.isArray(list) ? list : []).filter((option) => {
            const role = String(option?.equipment_role || "").toLowerCase();
            const isAllowedRole = role === "primary" || role === "alternative";
            const isActive = option?.is_active !== false;
            return isAllowedRole && isActive;
          });
          rawOptionsByLine[lineKey] = options;
          options.forEach((option) => {
            const machineId = Number(option?.machine_id);
            if (Number.isFinite(machineId) && machineId > 0) {
              machineIds.add(machineId);
            }
          });
        } catch {
          rawOptionsByLine[lineKey] = [];
        }
      }),
    );

    const machineLabelById = {};
    await Promise.all(
      Array.from(machineIds).map(async (machineId) => {
        try {
          const machine = await getMachineItem(machineId);
          const code = String(machine?.machine_code || "").trim();
          const name = String(machine?.machine_name || "").trim();
          machineLabelById[machineId] =
            [code, name].filter(Boolean).join(" — ") || `Станок #${machineId}`;
        } catch {
          machineLabelById[machineId] = `Станок #${machineId}`;
        }
      }),
    );

    const preparedOptionsByLine = {};
    weekLines.forEach((line) => {
      const lineKey = String(line.production_week_line_id);
      const options = rawOptionsByLine[lineKey] || [];
      preparedOptionsByLine[lineKey] = options.map((option) => {
        const machineId = Number(option.machine_id);
        const role = String(option.equipment_role || "").toLowerCase();
        const machineLabel = machineLabelById[machineId] || `Станок #${machineId}`;
        return {
          step_equipment_id: Number(option.step_equipment_id),
          machine_id: machineId,
          equipment_role: role,
          machine_display: machineLabel,
        };
      });
    });

    setEquipmentOptionsByLine(preparedOptionsByLine);
    setRowInputs((currentValue) => {
      const nextValue = { ...currentValue };

      weekLines.forEach((line) => {
        const lineKey = String(line.production_week_line_id);
        const options = preparedOptionsByLine[lineKey] || [];
        const currentInput = nextValue[lineKey] || buildDefaultRowInput(weekPayload.week_start_date);
        const optionIds = new Set(options.map((option) => String(option.step_equipment_id)));

        let selectedStepEquipmentId =
          currentInput.route_step_equipment_id !== null &&
          currentInput.route_step_equipment_id !== undefined
            ? String(currentInput.route_step_equipment_id)
            : "";

        if (!selectedStepEquipmentId || !optionIds.has(selectedStepEquipmentId)) {
          if (options.length === 1) {
            selectedStepEquipmentId = String(options[0].step_equipment_id);
          } else if (
            line.route_step_equipment_id !== null &&
            line.route_step_equipment_id !== undefined &&
            optionIds.has(String(line.route_step_equipment_id))
          ) {
            selectedStepEquipmentId = String(line.route_step_equipment_id);
          } else {
            selectedStepEquipmentId = "";
          }
        }

        nextValue[lineKey] = {
          ...currentInput,
          route_step_equipment_id: selectedStepEquipmentId,
        };
      });

      return nextValue;
    });
  }, []);

  const loadWeekDetails = useCallback(
    async (weekId, options = {}) => {
      const { preserveInputs = false } = options;

      if (!weekId) {
        setSelectedWeek(null);
        setRowInputs({});
        setExpandedClosedRows({});
        setEquipmentOptionsByLine({});
        return null;
      }

      setIsWeekLoading(true);
      setErrorText("");

      try {
        const weekPayload = await getProductionWeekPlan(Number(weekId));
        setSelectedWeek(weekPayload);
        setRowInputs((currentInputs) =>
          buildRowInputs(
            weekPayload.lines,
            weekPayload.week_start_date,
            preserveInputs ? currentInputs : {},
          ),
        );
        return weekPayload;
      } catch (error) {
        setSelectedWeek(null);
        setRowInputs({});
        setExpandedClosedRows({});
        setEquipmentOptionsByLine({});
        setErrorText(toErrorMessage(error, "Не удалось загрузить недельный план."));
        return null;
      } finally {
        setIsWeekLoading(false);
      }
    },
    [],
  );

  const loadApprovedPlans = useCallback(async () => {
    setIsPlansLoading(true);
    setErrorText("");

    try {
      const plans = await getProductionPlans();
      const approved = (Array.isArray(plans) ? plans : []).filter(
        (plan) => plan.status === "approved",
      );
      setApprovedPlans(approved);

      if (!approved.length) {
        setSelectedPlanId("");
        setWeekOptions([]);
        setSelectedWeekId("");
        setSelectedWeek(null);
        setRowInputs({});
        setExpandedClosedRows({});
        setEquipmentOptionsByLine({});
        setJournalRows([]);
        return;
      }

      setSelectedPlanId((currentValue) => {
        const hasCurrent = approved.some(
          (plan) => String(plan.production_plan_id) === String(currentValue),
        );
        return hasCurrent ? String(currentValue) : String(approved[0].production_plan_id);
      });
    } catch (error) {
      setApprovedPlans([]);
      setSelectedPlanId("");
      setWeekOptions([]);
      setSelectedWeekId("");
      setSelectedWeek(null);
      setRowInputs({});
      setExpandedClosedRows({});
      setEquipmentOptionsByLine({});
      setJournalRows([]);
      setErrorText(
        toErrorMessage(error, "Не удалось загрузить утверждённые месячные планы."),
      );
    } finally {
      setIsPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovedPlans();
  }, [loadApprovedPlans]);

  useEffect(() => {
    if (!successText) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setSuccessText("");
    }, SUCCESS_MESSAGE_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [successText]);

  useEffect(() => {
    let isCancelled = false;

    async function loadWeeks() {
      if (!selectedPlanId) {
        setWeekOptions([]);
        setSelectedWeekId("");
        setSelectedWeek(null);
        setRowInputs({});
        setExpandedClosedRows({});
        setEquipmentOptionsByLine({});
        setJournalRows([]);
        return;
      }

      setIsWeeksLoading(true);
      setErrorText("");
      setSuccessText("");

      try {
        const weeks = await getProductionPlanWeeks(Number(selectedPlanId));
        if (isCancelled) {
          return;
        }

        const sortedWeeks = [...(Array.isArray(weeks) ? weeks : [])].sort(
          (left, right) => Number(left.week_no) - Number(right.week_no),
        );
        setWeekOptions(sortedWeeks);
        setSelectedWeekId((currentValue) => {
          const hasCurrent = sortedWeeks.some(
            (week) => String(week.production_plan_week_id) === String(currentValue),
          );
          return hasCurrent
            ? String(currentValue)
            : sortedWeeks[0]
              ? String(sortedWeeks[0].production_plan_week_id)
              : "";
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setWeekOptions([]);
        setSelectedWeekId("");
        setSelectedWeek(null);
        setRowInputs({});
        setExpandedClosedRows({});
        setEquipmentOptionsByLine({});
        setJournalRows([]);
        setErrorText(toErrorMessage(error, "Не удалось загрузить недельные планы."));
      } finally {
        if (!isCancelled) {
          setIsWeeksLoading(false);
        }
      }
    }

    loadWeeks();

    return () => {
      isCancelled = true;
    };
  }, [selectedPlanId]);

  useEffect(() => {
    async function syncWeek() {
      if (!selectedWeekId) {
        setSelectedWeek(null);
        setRowInputs({});
        setExpandedClosedRows({});
        setEquipmentOptionsByLine({});
        setJournalRows([]);
        return;
      }

      setExpandedClosedRows({});
      const weekPayload = await loadWeekDetails(selectedWeekId, { preserveInputs: false });
      await Promise.all([
        loadJournal(weekPayload),
        loadEquipmentOptionsForWeek(weekPayload),
      ]);
    }

    syncWeek();
  }, [loadEquipmentOptionsForWeek, loadJournal, loadWeekDetails, selectedWeekId]);

  const handleRefresh = async () => {
    setSuccessText("");
    await loadApprovedPlans();
  };

  const handleRowInputChange = (lineId, field, value) => {
    const lineKey = String(lineId);
    setRowInputs((currentValue) => {
      const currentLineInput =
        currentValue[lineKey] || buildDefaultRowInput(selectedWeek?.week_start_date);
      return {
        ...currentValue,
        [lineKey]: {
          ...currentLineInput,
          [field]: value,
        },
      };
    });
  };

  const openFactCommentEditorModal = (lineId) => {
    const lineKey = String(lineId);
    const currentInput =
      rowInputs[lineKey] || buildDefaultRowInput(selectedWeek?.week_start_date);
    setFactCommentModalState({
      isOpen: true,
      mode: "edit",
      lineKey,
      value: currentInput.comment || "",
    });
  };

  const openFactCommentViewModal = (comment) => {
    setFactCommentModalState({
      isOpen: true,
      mode: "view",
      lineKey: "",
      value: comment || "",
    });
  };

  const closeFactCommentModal = () => {
    setFactCommentModalState({
      isOpen: false,
      mode: "edit",
      lineKey: "",
      value: "",
    });
  };

  const applyFactCommentModal = () => {
    if (factCommentModalState.mode === "edit" && factCommentModalState.lineKey) {
      handleRowInputChange(factCommentModalState.lineKey, "comment", factCommentModalState.value);
    }
    closeFactCommentModal();
  };

  const openTaskInstructionModal = (instructionText) => {
    setTaskInstructionModalState({
      isOpen: true,
      value: instructionText || "",
    });
  };

  const closeTaskInstructionModal = () => {
    setTaskInstructionModalState({
      isOpen: false,
      value: "",
    });
  };

  const handleExpandClosedRow = (lineId) => {
    const lineKey = String(lineId);
    setExpandedClosedRows((currentValue) => ({
      ...currentValue,
      [lineKey]: true,
    }));
  };

  const handleSaveRowFact = async (line) => {
    if (!selectedWeek) {
      setErrorText("Выберите недельный план.");
      return;
    }

    const lineKey = String(line.production_week_line_id);
    const input = rowInputs[lineKey] || buildDefaultRowInput(selectedWeek.week_start_date);
    const equipmentOptions = equipmentOptionsByLine[lineKey] || [];
    const selectedDate = String(input.actual_date || "").trim();
    const weekStartDate = String(selectedWeek.week_start_date || "");
    const weekEndDate = String(selectedWeek.week_end_date || "");

    if (!selectedDate) {
      setErrorText("Выберите дату факта.");
      return;
    }

    if (selectedDate < weekStartDate || selectedDate > weekEndDate) {
      setErrorText("Дата факта должна быть в пределах выбранной недели.");
      return;
    }

    if (!input.shift_type) {
      setErrorText("Выберите тип смены.");
      return;
    }

    if (!input.shift_team_no) {
      setErrorText("Выберите смену / бригаду.");
      return;
    }

    const parsedActualQty = parsePositiveQty(input.actual_qty);
    if (parsedActualQty === null) {
      setErrorText("Введите факт выпуска больше нуля.");
      return;
    }

    let selectedMachineId = null;
    let selectedRouteStepEquipmentId = "";
    if (line.route_step_equipment_id !== null && line.route_step_equipment_id !== undefined) {
      selectedRouteStepEquipmentId =
        input.route_step_equipment_id !== null && input.route_step_equipment_id !== undefined
          ? String(input.route_step_equipment_id)
          : "";

      if (equipmentOptions.length > 0) {
        const selectedOption = equipmentOptions.find(
          (option) => String(option.step_equipment_id) === selectedRouteStepEquipmentId,
        );
        if (!selectedOption) {
          setErrorText("Выберите оборудование операции.");
          return;
        }
        selectedMachineId = selectedOption.machine_id;
      }
    }

    setSavingLineId(Number(line.production_week_line_id));
    setErrorText("");
    setSuccessText("");

    try {
      await createProductionActual({
        production_week_line_id: Number(line.production_week_line_id),
        actual_date: selectedDate,
        shift_type: input.shift_type,
        shift_team_no: Number(input.shift_team_no),
        actual_qty: parsedActualQty,
        machine_id: selectedMachineId,
        comment: input.comment ? String(input.comment).trim() || null : null,
      });

      setSuccessText("Факт сохранён.");
      setRowInputs((currentValue) => ({
        ...currentValue,
        [lineKey]: {
          actual_date:
            (currentValue[lineKey] || buildDefaultRowInput(selectedWeek.week_start_date))
              .actual_date || selectedWeek.week_start_date || "",
          route_step_equipment_id:
            (currentValue[lineKey] || buildDefaultRowInput(selectedWeek.week_start_date))
              .route_step_equipment_id || "",
          shift_type: "",
          shift_team_no: "",
          actual_qty: "",
          comment: "",
        },
      }));
      setExpandedClosedRows((currentValue) => {
        const nextValue = { ...currentValue };
        delete nextValue[lineKey];
        return nextValue;
      });

      const weekPayload = await loadWeekDetails(selectedWeekId, { preserveInputs: true });
      await Promise.all([
        loadJournal(weekPayload),
        loadEquipmentOptionsForWeek(weekPayload),
      ]);
    } catch (error) {
      setErrorText(toErrorMessage(error, "Не удалось сохранить факт выпуска."));
    } finally {
      setSavingLineId(null);
    }
  };

  const handleDeleteActual = async (actualRow) => {
    setDeletingActualId(Number(actualRow.production_actual_id));
    setErrorText("");
    setSuccessText("");

    try {
      await deleteProductionActual(Number(actualRow.production_actual_id));
      setSuccessText("Запись факта удалена.");
      const weekPayload = await loadWeekDetails(selectedWeekId, { preserveInputs: true });
      await Promise.all([
        loadJournal(weekPayload),
        loadEquipmentOptionsForWeek(weekPayload),
      ]);
    } catch (error) {
      setErrorText(toErrorMessage(error, "Не удалось удалить запись факта."));
    } finally {
      setDeletingActualId(null);
    }
  };

  const openFactEditModal = (actualRow) => {
    const lineKey = String(actualRow.production_week_line_id || "");
    const equipmentOptions = equipmentOptionsByLine[lineKey] || [];
    const machineId = Number(actualRow.machine_id);
    const matchedOption = Number.isFinite(machineId)
      ? equipmentOptions.find((option) => Number(option.machine_id) === machineId)
      : null;

    setFactEditModalState({
      isOpen: true,
      production_actual_id: Number(actualRow.production_actual_id),
      production_week_line_id: Number(actualRow.production_week_line_id),
      actual_date: String(actualRow.actual_date || ""),
      shift_type:
        actualRow.shift_type === "day" || actualRow.shift_type === "night"
          ? actualRow.shift_type
          : "",
      shift_team_no: TEAM_OPTIONS.includes(String(actualRow.shift_team_no))
        ? String(actualRow.shift_team_no)
        : "",
      actual_qty: normalizeInitialActualQty(actualRow.actual_qty),
      route_step_equipment_id: matchedOption ? String(matchedOption.step_equipment_id) : "",
      comment: actualRow.comment || "",
    });
  };

  const closeFactEditModal = () => {
    setFactEditModalState({
      isOpen: false,
      production_actual_id: null,
      production_week_line_id: null,
      actual_date: "",
      shift_type: "",
      shift_team_no: "",
      actual_qty: "",
      route_step_equipment_id: "",
      comment: "",
    });
  };

  const handleFactEditFieldChange = (field, value) => {
    setFactEditModalState((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  };

  const handleSaveEditedActual = async () => {
    if (!selectedWeek) {
      setErrorText("Выберите недельный план.");
      return;
    }

    const actualId = Number(factEditModalState.production_actual_id);
    const weekLineId = Number(factEditModalState.production_week_line_id);
    if (!Number.isFinite(actualId) || actualId <= 0 || !Number.isFinite(weekLineId) || weekLineId <= 0) {
      setErrorText("Не удалось определить запись факта для редактирования.");
      return;
    }

    const selectedDate = String(factEditModalState.actual_date || "").trim();
    if (!selectedDate) {
      setErrorText("Выберите дату факта.");
      return;
    }

    const weekStartDate = String(selectedWeek.week_start_date || "");
    const weekEndDate = String(selectedWeek.week_end_date || "");
    if (selectedDate < weekStartDate || selectedDate > weekEndDate) {
      setErrorText("Дата факта должна быть в пределах выбранной недели.");
      return;
    }

    if (!factEditModalState.shift_type) {
      setErrorText("Выберите тип смены.");
      return;
    }

    if (!factEditModalState.shift_team_no) {
      setErrorText("Выберите смену / бригаду.");
      return;
    }

    const parsedActualQty = parsePositiveQty(factEditModalState.actual_qty);
    if (parsedActualQty === null) {
      setErrorText("Введите факт выпуска больше нуля.");
      return;
    }

    const lineKey = String(weekLineId);
    const equipmentOptions = equipmentOptionsByLine[lineKey] || [];
    let selectedMachineId = null;

    if (factEditModalState.route_step_equipment_id) {
      const selectedOption = equipmentOptions.find(
        (option) =>
          String(option.step_equipment_id) === String(factEditModalState.route_step_equipment_id),
      );
      if (!selectedOption) {
        setErrorText("Выберите оборудование операции.");
        return;
      }
      selectedMachineId = Number(selectedOption.machine_id);
    }

    setEditingActualId(actualId);
    setErrorText("");
    setSuccessText("");

    try {
      await updateProductionActual(actualId, {
        production_week_line_id: weekLineId,
        actual_date: selectedDate,
        shift_type: factEditModalState.shift_type,
        shift_team_no: Number(factEditModalState.shift_team_no),
        actual_qty: parsedActualQty,
        machine_id: selectedMachineId,
        comment: factEditModalState.comment ? String(factEditModalState.comment).trim() || null : null,
      });

      setSuccessText("Факт выпуска обновлён.");
      closeFactEditModal();

      const weekPayload = await loadWeekDetails(selectedWeekId, { preserveInputs: true });
      await Promise.all([
        loadJournal(weekPayload),
        loadEquipmentOptionsForWeek(weekPayload),
      ]);
    } catch (error) {
      setErrorText(toErrorMessage(error, "Не удалось обновить факт выпуска."));
    } finally {
      setEditingActualId(null);
    }
  };

  const noApprovedPlans = !isPlansLoading && approvedPlans.length === 0;
  const noSavedWeeks = !isWeeksLoading && selectedPlanId && weekOptions.length === 0;
  const noWeekLines =
    !isWeekLoading && Boolean(selectedWeekId) && sortedWeekLines.length === 0;

  return (
    <div className="space-y-5">
      <section className="rounded-none border border-cyan-300/14 bg-cyan-500/[0.04] p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[300px] flex-1">
            <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Месячный план</div>
            <select
              value={selectedPlanId}
              onChange={(event) => setSelectedPlanId(event.target.value)}
              disabled={isPlansLoading || noApprovedPlans}
              className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40 disabled:opacity-60"
            >
              {noApprovedPlans ? (
                <option value="">Нет утверждённых месячных планов.</option>
              ) : (
                approvedPlans.map((plan) => (
                  <option key={plan.production_plan_id} value={plan.production_plan_id}>
                    {formatPlanMonth(plan.plan_month)} — {plan.plan_name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="min-w-[260px] flex-1">
            <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Неделя</div>
            <select
              value={selectedWeekId}
              onChange={(event) => setSelectedWeekId(event.target.value)}
              disabled={isWeeksLoading || noSavedWeeks || !weekOptions.length}
              className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40 disabled:opacity-60"
            >
              {noSavedWeeks ? (
                <option value="">Для выбранного плана нет сохранённых недель.</option>
              ) : !weekOptions.length ? (
                <option value="">Выберите месячный план.</option>
              ) : (
                weekOptions.map((week) => (
                  <option key={week.production_plan_week_id} value={week.production_plan_week_id}>
                    {formatWeekOption(week)}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isPlansLoading || isWeeksLoading || isWeekLoading}
            className="inline-flex h-11 items-center gap-2 rounded-none border border-white/12 px-4 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-60"
          >
            <RefreshCw
              className={[
                "h-4 w-4",
                isPlansLoading || isWeeksLoading || isWeekLoading ? "animate-spin" : "",
              ].join(" ")}
            />
            Обновить
          </button>
        </div>
      </section>

      {successText ? (
        <div className="rounded-none border border-emerald-300/30 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-100">
          {successText}
        </div>
      ) : null}
      {errorText ? (
        <div className="rounded-none border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
          {errorText}
        </div>
      ) : null}
      {journalErrorText ? (
        <div className="rounded-none border border-amber-300/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-100">
          {journalErrorText}
        </div>
      ) : null}

      <section className="glass-panel p-5 sm:p-6">
        <h3 className="text-xl font-semibold tracking-tight text-slate-50">
          Активный план на неделю
        </h3>

        {noApprovedPlans ? (
          <div className="mt-4 text-sm text-slate-400">Нет утверждённых месячных планов.</div>
        ) : noSavedWeeks ? (
          <div className="mt-4 text-sm text-slate-400">
            Для выбранного плана нет сохранённых недель.
          </div>
        ) : isWeekLoading ? (
          <div className="mt-4 text-sm text-slate-300">Загружаем недельный план...</div>
        ) : noWeekLines ? (
          <div className="mt-4 text-sm text-slate-400">В выбранной неделе нет строк.</div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10">
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-right font-medium">Очер.</th>
                    <th className="px-3 py-2 text-left font-medium">Код</th>
                    <th className="px-3 py-2 text-left font-medium">Номенклатура</th>
                    <th className="px-3 py-2 text-left font-medium">Станок</th>
                    <th className="px-3 py-2 text-right font-medium">План недели</th>
                    <th className="px-3 py-2 text-right font-medium">Осталось</th>
                    <th className="px-3 py-2 text-left font-medium">Дата</th>
                    <th className="px-3 py-2 text-left font-medium">Тип смены</th>
                    <th className="px-3 py-2 text-left font-medium">Бригада</th>
                    <th className="px-3 py-2 text-right font-medium">Факт</th>
                    <th className="px-3 py-2 text-left font-medium">Комм.</th>
                    <th className="px-3 py-2 text-right font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWeekLines.map((line) => {
                    const lineKey = String(line.production_week_line_id);
                    const input =
                      rowInputs[lineKey] || buildDefaultRowInput(selectedWeek?.week_start_date);
                    const equipmentOptions = equipmentOptionsByLine[lineKey] || [];
                    const selectedEquipmentOption = equipmentOptions.find(
                      (option) =>
                        String(option.step_equipment_id) ===
                        String(input.route_step_equipment_id || ""),
                    );
                    const isRowSaving = Number(savingLineId) === Number(line.production_week_line_id);
                    const overproductionQty = Number(line.overproduction_qty || 0);
                    const isClosedLine = isWeekLineClosed(line);
                    const isClosedExpanded = Boolean(expandedClosedRows[lineKey]);
                    const showInputs = !isClosedLine || isClosedExpanded;

                    return (
                      <tr
                        key={line.production_week_line_id}
                        className={[
                          "border-t border-white/[0.05] hover:bg-cyan-300/[0.03]",
                          isClosedLine ? "bg-emerald-500/[0.07]" : "",
                        ].join(" ")}
                      >
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">
                          {line.sequence_no}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-100">
                          {line.nomenclature_code}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          <div className="flex flex-col items-start gap-1">
                            <span>{line.nomenclature_name}</span>
                            {String(line.comment || "").trim() ? (
                              <button
                                type="button"
                                onClick={() => openTaskInstructionModal(String(line.comment))}
                                className="inline-flex items-center gap-1 rounded-none border border-cyan-300/25 bg-cyan-400/[0.08] px-1.5 py-0.5 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-400/[0.16]"
                              >
                                <span>💬</span>
                                <span>Доп. указания</span>
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {line.route_step_equipment_id === null ||
                          line.route_step_equipment_id === undefined ? (
                            <span className="text-slate-500">Оборудование не задано</span>
                          ) : showInputs ? (
                            equipmentOptions.length > 1 ? (
                              <select
                                value={input.route_step_equipment_id || ""}
                                onChange={(event) =>
                                  handleRowInputChange(
                                    line.production_week_line_id,
                                    "route_step_equipment_id",
                                    event.target.value,
                                  )
                                }
                                className="h-9 w-[230px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.7)] px-2 text-sm font-medium text-slate-100 outline-none focus:border-cyan-300/40"
                              >
                                {equipmentOptions.map((option) => (
                                  <option
                                    key={option.step_equipment_id}
                                    value={option.step_equipment_id}
                                  >
                                    {option.machine_display}
                                  </option>
                                ))}
                              </select>
                            ) : equipmentOptions.length === 1 ? (
                              <span>{equipmentOptions[0].machine_display}</span>
                            ) : (
                              <span className="text-slate-500">Оборудование не задано</span>
                            )
                          ) : (
                            <span>
                              {selectedEquipmentOption?.machine_display ||
                                formatMachineDisplay(line.machine_code, line.machine_name)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">
                          {formatQty(line.planned_qty)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">
                          {isClosedLine ? (
                            <div className="flex flex-col items-end gap-0.5 leading-tight">                              <span className="text-[11px] text-emerald-100">✓ Готово</span>
                              {overproductionQty > 0 ? (
                                <span className="text-[11px] text-amber-100">
                                  +{formatQty(overproductionQty)} сверх плана
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            formatQty(line.remaining_to_produce_qty)
                          )}
                        </td>
                        {showInputs ? (
                          <>
                            <td className="px-3 py-2.5">
                              <input
                                type="date"
                                value={input.actual_date}
                                min={selectedWeek?.week_start_date || undefined}
                                max={selectedWeek?.week_end_date || undefined}
                                onChange={(event) =>
                                  handleRowInputChange(
                                    line.production_week_line_id,
                                    "actual_date",
                                    event.target.value,
                                  )
                                }
                                className="h-9 w-[150px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.7)] px-2 text-sm font-medium text-slate-100 outline-none focus:border-cyan-300/40"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <select
                                value={input.shift_type}
                                onChange={(event) =>
                                  handleRowInputChange(
                                    line.production_week_line_id,
                                    "shift_type",
                                    event.target.value,
                                  )
                                }
                                className="h-9 w-[108px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.7)] px-2 text-sm font-medium text-slate-100 outline-none focus:border-cyan-300/40"
                              >
                                <option value="">{"\u2014"}</option>
                                {SHIFT_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2.5">
                              <select
                                value={input.shift_team_no}
                                onChange={(event) =>
                                  handleRowInputChange(
                                    line.production_week_line_id,
                                    "shift_team_no",
                                    event.target.value,
                                  )
                                }
                                className="h-9 w-[78px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.7)] px-2 text-sm font-medium text-slate-100 outline-none focus:border-cyan-300/40"
                              >
                                <option value="">{"\u2014"}</option>
                                {TEAM_OPTIONS.map((teamNo) => (
                                  <option key={teamNo} value={teamNo}>
                                    {teamNo}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={input.actual_qty ?? ""}
                                onChange={(event) =>
                                  handleRowInputChange(
                                    line.production_week_line_id,
                                    "actual_qty",
                                    event.target.value,
                                  )
                                }
                                placeholder="0"
                                className="h-9 w-[104px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.7)] px-2 text-right tabular-nums text-sm font-medium text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-300/40"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => openFactCommentEditorModal(line.production_week_line_id)}
                                aria-label="Комментарий к факту"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-white/[0.12] bg-[rgba(8,22,34,0.72)] text-sm text-slate-100 transition hover:border-cyan-300/40 hover:text-cyan-100"
                              >
                                {String(input.comment || "").trim() ? "💬" : "+"}
                              </button>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleSaveRowFact(line)}
                                disabled={isRowSaving}
                                className="h-9 rounded-none border border-cyan-300/35 bg-cyan-400/[0.14] px-3 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-50 transition hover:bg-cyan-400/[0.22] disabled:opacity-50"
                              >
                                {isRowSaving ? "Сохраняем..." : "Сохранить"}
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleExpandClosedRow(line.production_week_line_id)}
                                className="h-9 rounded-none border border-cyan-300/30 bg-cyan-400/[0.1] px-3 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-100 transition hover:bg-cyan-400/[0.2]"
                              >
                                Добавить факт
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="glass-panel p-5 sm:p-6">
        <h3 className="text-xl font-semibold tracking-tight text-slate-50">
          Журнал выполнения
        </h3>

        {!selectedWeekId ? (
          <div className="mt-4 text-sm text-slate-400">Выберите неделю для просмотра журнала.</div>
        ) : isJournalLoading ? (
          <div className="mt-4 text-sm text-slate-300">Загружаем журнал выполнения...</div>
        ) : journalRows.length === 0 ? (
          <div className="mt-4 text-sm text-slate-400">
            По выбранной неделе фактов пока нет.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10">
            <div className="max-h-[460px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Дата</th>
                    <th className="px-3 py-2 text-left font-medium">Тип смены</th>
                    <th className="px-3 py-2 text-left font-medium">Бригада</th>
                    <th className="px-3 py-2 text-left font-medium">Код</th>
                    <th className="px-3 py-2 text-left font-medium">Номенклатура</th>
                    <th className="px-3 py-2 text-left font-medium">Станок</th>
                    <th className="px-3 py-2 text-right font-medium">Факт</th>
                    <th className="px-3 py-2 text-left font-medium">Комм.</th>
                    <th className="px-3 py-2 text-right font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {journalRows.map((actualRow) => {
                    const isDeleting =
                      Number(deletingActualId) === Number(actualRow.production_actual_id);
                    const isEditing =
                      Number(editingActualId) === Number(actualRow.production_actual_id);
                    return (
                      <tr
                        key={actualRow.production_actual_id}
                        className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]"
                      >
                        <td className="px-3 py-2.5 text-slate-200">
                          {formatDate(actualRow.actual_date)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {getShiftLabel(actualRow.shift_type)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {actualRow.shift_team_no}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-100">
                          {actualRow.nomenclature_code}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {actualRow.nomenclature_name}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {formatMachineDisplay(actualRow.machine_code, actualRow.machine_name)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">
                          {formatQty(actualRow.actual_qty)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {String(actualRow.comment || "").trim() ? (
                            <button
                              type="button"
                              onClick={() => openFactCommentViewModal(String(actualRow.comment))}
                              aria-label="Показать комментарий к факту"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-white/[0.12] bg-[rgba(8,22,34,0.72)] text-sm text-slate-100 transition hover:border-cyan-300/40 hover:text-cyan-100"
                            >
                              💬
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openFactEditModal(actualRow)}
                              disabled={isDeleting || isEditing}
                              title="Изменить"
                              aria-label="Изменить"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-cyan-300/28 bg-cyan-400/[0.08] text-cyan-100 transition hover:border-cyan-300/42 hover:bg-cyan-400/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Pencil className={["h-4 w-4", isEditing ? "animate-pulse" : ""].join(" ")} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteActual(actualRow)}
                              disabled={isDeleting || isEditing}
                              title="Удалить"
                              aria-label="Удалить"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-rose-300/30 bg-rose-500/[0.1] text-rose-100 transition hover:border-rose-300/45 hover:bg-rose-500/[0.18] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className={["h-4 w-4", isDeleting ? "animate-pulse" : ""].join(" ")} />
                            </button>
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

      {factEditModalState.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-none border border-cyan-300/20 bg-[rgba(10,24,36,0.98)] p-5 shadow-[0_22px_80px_rgba(6,10,14,0.65)]">
            <div className="text-lg font-semibold text-slate-50">Редактирование факта выпуска</div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Дата факта</div>
                <input
                  type="date"
                  value={factEditModalState.actual_date}
                  min={selectedWeek?.week_start_date || undefined}
                  max={selectedWeek?.week_end_date || undefined}
                  onChange={(event) => handleFactEditFieldChange("actual_date", event.target.value)}
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </div>
              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Тип смены</div>
                <select
                  value={factEditModalState.shift_type}
                  onChange={(event) => handleFactEditFieldChange("shift_type", event.target.value)}
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                >
                  <option value="">{"—"}</option>
                  {SHIFT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Бригада</div>
                <select
                  value={factEditModalState.shift_team_no}
                  onChange={(event) => handleFactEditFieldChange("shift_team_no", event.target.value)}
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                >
                  <option value="">{"—"}</option>
                  {TEAM_OPTIONS.map((teamNo) => (
                    <option key={teamNo} value={teamNo}>
                      {teamNo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Оборудование</div>
                {(() => {
                  const lineKey = String(factEditModalState.production_week_line_id || "");
                  const equipmentOptions = equipmentOptionsByLine[lineKey] || [];
                  if (!equipmentOptions.length) {
                    return (
                      <div className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.6)] px-2 text-sm text-slate-400 flex items-center">
                        Не выбрано
                      </div>
                    );
                  }
                  return (
                    <select
                      value={factEditModalState.route_step_equipment_id}
                      onChange={(event) => handleFactEditFieldChange("route_step_equipment_id", event.target.value)}
                      className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    >
                      <option value="">Не выбрано</option>
                      {equipmentOptions.map((option) => (
                        <option key={option.step_equipment_id} value={option.step_equipment_id}>
                          {option.machine_display}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
              <div className="sm:col-span-2">
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Факт</div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={factEditModalState.actual_qty ?? ""}
                  onChange={(event) => handleFactEditFieldChange("actual_qty", event.target.value)}
                  placeholder="0"
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-right tabular-nums text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-300/40"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Комментарий</div>
                <textarea
                  value={factEditModalState.comment}
                  onChange={(event) => handleFactEditFieldChange("comment", event.target.value)}
                  rows={4}
                  className="w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeFactEditModal}
                disabled={Number(editingActualId) === Number(factEditModalState.production_actual_id)}
                className="h-9 rounded-none border border-white/15 px-4 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveEditedActual}
                disabled={Number(editingActualId) === Number(factEditModalState.production_actual_id)}
                className="h-9 rounded-none border border-cyan-300/35 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.24] disabled:opacity-50"
              >
                {Number(editingActualId) === Number(factEditModalState.production_actual_id)
                  ? "Сохраняем..."
                  : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {factCommentModalState.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-none border border-cyan-300/20 bg-[rgba(10,24,36,0.98)] p-5 shadow-[0_22px_80px_rgba(6,10,14,0.65)]">
            <div className="text-lg font-semibold text-slate-50">Комментарий к факту</div>
            <textarea
              value={factCommentModalState.value}
              onChange={(event) =>
                setFactCommentModalState((currentValue) => ({
                  ...currentValue,
                  value: event.target.value,
                }))
              }
              rows={6}
              readOnly={factCommentModalState.mode === "view"}
              className={[
                "mt-4 w-full rounded-none border border-white/[0.12] bg-[rgba(8,22,34,0.82)] px-3 py-2 text-sm text-slate-100 outline-none",
                factCommentModalState.mode === "view"
                  ? "cursor-default"
                  : "focus:border-cyan-300/40",
              ].join(" ")}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeFactCommentModal}
                className="h-9 rounded-none border border-white/15 px-4 text-sm text-slate-200 transition hover:border-cyan-300/30"
              >
                {factCommentModalState.mode === "view" ? "Закрыть" : "Отмена"}
              </button>
              {factCommentModalState.mode === "edit" ? (
                <button
                  type="button"
                  onClick={applyFactCommentModal}
                  className="h-9 rounded-none border border-cyan-300/35 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.24]"
                >
                  Применить
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {taskInstructionModalState.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-none border border-cyan-300/20 bg-[rgba(10,24,36,0.98)] p-5 shadow-[0_22px_80px_rgba(6,10,14,0.65)]">
            <div className="text-lg font-semibold text-slate-50">Доп. указания к заданию</div>
            <div className="mt-4 max-h-[300px] overflow-auto whitespace-pre-wrap rounded-none border border-white/[0.12] bg-[rgba(8,22,34,0.82)] px-3 py-2 text-sm text-slate-100">
              {taskInstructionModalState.value}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={closeTaskInstructionModal}
                className="h-9 rounded-none border border-white/15 px-4 text-sm text-slate-200 transition hover:border-cyan-300/30"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

export default ShiftFactPanel;
