import { AlertCircle, CheckCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import V2ConfirmDialog from "../components/common/V2ConfirmDialog";
import {
  closeEquipmentDowntime,
  createEquipmentDowntime,
  deleteEquipmentDowntime,
  getEquipmentDowntimes,
  updateEquipmentDowntime,
} from "../services/equipmentDowntimesApi";
import { getDowntimeReasons } from "../services/downtimeReasonsApi";
import { getMachinesList } from "../services/machinesApi";
import { useRole } from "../auth/useRole";

const BASE_TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minuteOptions = ["00", "15", "30", "45"];
  const minutes = minuteOptions[index % 4];
  return `${String(hours).padStart(2, "0")}:${minutes}`;
});

const STATUS_OPTIONS = [
  { value: "", label: "Все" },
  { value: "open", label: "Открытые" },
  { value: "closed", label: "Закрытые" },
];

function toErrorMessage(error, fallbackText) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackText;
}

function toDowntimeWriteErrorMessage(error, fallbackText) {
  if (error?.status === 403 || error?.message === "Forbidden") {
    return "Недостаточно прав для изменения внепланового простоя.";
  }
  return toErrorMessage(error, fallbackText);
}

function splitDateTime(value) {
  if (!value) {
    return { date: "", time: "" };
  }

  const normalized = String(value).trim().replace(" ", "T");
  const [datePart = "", timePartWithRest = ""] = normalized.split("T");
  const timePart = timePartWithRest.slice(0, 5);

  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : "",
    time: /^\d{2}:\d{2}$/.test(timePart) ? timePart : "",
  };
}

function buildApiDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return "";
  }

  return `${dateValue}T${timeValue}:00`;
}

function parseDateTime(dateValue, timeValue) {
  const dateTimeValue = buildApiDateTime(dateValue, timeValue);
  if (!dateTimeValue) {
    return null;
  }

  const parsed = new Date(dateTimeValue);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const normalized = String(value).includes("T") ? String(value) : String(value).replace(" ", "T");
  const parsedDate = new Date(normalized);
  if (Number.isNaN(parsedDate.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

function roundToQuarterHour(date = new Date()) {
  const nextDate = new Date(date);
  nextDate.setSeconds(0, 0);
  const minutes = nextDate.getMinutes();
  nextDate.setMinutes(Math.floor(minutes / 15) * 15);
  return nextDate;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function createDefaultFormState() {
  const now = roundToQuarterHour();

  return {
    machine_id: "",
    downtime_reason_id: "",
    started_date: toDateInputValue(now),
    started_time: toTimeInputValue(now),
    ended_date: "",
    ended_time: "",
    comment: "",
  };
}

function createDefaultCloseState(item) {
  const now = roundToQuarterHour();
  const started = splitDateTime(item?.started_at);

  return {
    ended_date: started.date || toDateInputValue(now),
    ended_time: toTimeInputValue(now),
    comment: item?.comment || "",
  };
}

function toFiniteNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatHours(value, suffix = "ч") {
  const number = toFiniteNumber(value);
  if (number === null) {
    return "—";
  }

  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number);

  return `${formatted} ${suffix}`;
}

function buildTimeOptions(...currentValues) {
  const optionsSet = new Set(BASE_TIME_OPTIONS);

  currentValues.forEach((value) => {
    if (/^\d{2}:\d{2}$/.test(String(value || ""))) {
      optionsSet.add(String(value));
    }
  });

  return Array.from(optionsSet).sort((left, right) => left.localeCompare(right));
}

function getMachineDisplay(machineCode, machineName) {
  const code = String(machineCode || "").trim();
  const name = String(machineName || "").trim();

  if (code && name) {
    return `${code} — ${name}`;
  }

  return code || name || "—";
}

function getReasonDisplay(reasonCode, reasonName) {
  const code = String(reasonCode || "").trim();
  const name = String(reasonName || "").trim();

  if (code && name) {
    return `${code} — ${name}`;
  }

  return code || name || "—";
}

function getDurationPreview(startedDate, startedTime, endedDate, endedTime) {
  const startedAt = parseDateTime(startedDate, startedTime);
  const endedAt = parseDateTime(endedDate, endedTime);

  if (!endedDate && !endedTime) {
    return "Простой будет сохранён как открытый.";
  }

  if (!startedAt || !endedAt || endedAt <= startedAt) {
    return "Длительность: —";
  }

  const hours = (endedAt.getTime() - startedAt.getTime()) / 1000 / 60 / 60;
  return `Длительность: ${formatHours(hours)}`;
}

function getCloseDurationPreview(startedAtValue, endedDate, endedTime) {
  const started = splitDateTime(startedAtValue);
  const startedAt = parseDateTime(started.date, started.time);
  const endedAt = parseDateTime(endedDate, endedTime);

  if (!startedAt || !endedAt || endedAt <= startedAt) {
    return "Итоговая длительность: —";
  }

  const hours = (endedAt.getTime() - startedAt.getTime()) / 1000 / 60 / 60;
  return `Итоговая длительность: ${formatHours(hours)}`;
}

function EquipmentDowntimesSection() {
  const { user } = useRole();
  const role = user?.role;
  const canCreateDowntime =
    role === "admin" || role === "planner" || role === "master" || role === "maintenance";
  const canEditDowntimeBase = canCreateDowntime;
  const canDeleteDowntimeBase = canCreateDowntime;

  const [machines, setMachines] = useState([]);
  const [downtimeReasons, setDowntimeReasons] = useState([]);
  const [downtimeItems, setDowntimeItems] = useState([]);
  const [filters, setFilters] = useState({
    machine_id: "",
    downtime_reason_id: "",
    reason_category: "",
    status: "",
    date_from: "",
    date_to: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [closeError, setCloseError] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);
  const [closingItem, setClosingItem] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const canSubmitDowntimeForm = formMode === "create" ? canCreateDowntime : canEditDowntimeBase;

  const [formState, setFormState] = useState(createDefaultFormState);
  const [closeState, setCloseState] = useState(createDefaultCloseState(null));

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(
        downtimeReasons
          .map((item) => String(item?.reason_category || "").trim())
          .filter(Boolean),
      ),
    );

    return categories.sort((left, right) => left.localeCompare(right, "ru"));
  }, [downtimeReasons]);

  const timeOptions = useMemo(
    () =>
      buildTimeOptions(
        formState.started_time,
        formState.ended_time,
        closeState.ended_time,
      ),
    [closeState.ended_time, formState.ended_time, formState.started_time],
  );

  const selectedReason = useMemo(
    () =>
      downtimeReasons.find(
        (item) => String(item.downtime_reason_id) === String(formState.downtime_reason_id),
      ) ?? null,
    [downtimeReasons, formState.downtime_reason_id],
  );

  const durationPreview = useMemo(
    () =>
      getDurationPreview(
        formState.started_date,
        formState.started_time,
        formState.ended_date,
        formState.ended_time,
      ),
    [formState.ended_date, formState.ended_time, formState.started_date, formState.started_time],
  );

  const closeDurationPreview = useMemo(
    () =>
      getCloseDurationPreview(
        closingItem?.started_at,
        closeState.ended_date,
        closeState.ended_time,
      ),
    [closeState.ended_date, closeState.ended_time, closingItem?.started_at],
  );

  const openDowntimeCount = useMemo(
    () => downtimeItems.filter((item) => item.status === "open").length,
    [downtimeItems],
  );

  const loadEquipmentDowntimes = async (nextFilters = filters, options = { showLoader: true }) => {
    const shouldShowLoader = options.showLoader !== false;

    if (shouldShowLoader) {
      setIsListLoading(true);
    }
    setPageError("");

    try {
      const items = await getEquipmentDowntimes(nextFilters);
      setDowntimeItems(Array.isArray(items) ? items : []);
    } catch (error) {
      setDowntimeItems([]);
      setPageError(toErrorMessage(error, "Не удалось загрузить журнал внеплановых простоев."));
    } finally {
      if (shouldShowLoader) {
        setIsListLoading(false);
      }
    }
  };

  useEffect(() => {
    let isCancelled = false;

    async function loadInitial() {
      setIsLoading(true);
      setLoadError("");
      setPageError("");

      try {
        const [machinesResponse, reasonsResponse, downtimesResponse] = await Promise.all([
          getMachinesList(),
          getDowntimeReasons(),
          getEquipmentDowntimes(),
        ]);

        if (isCancelled) {
          return;
        }

        setMachines(Array.isArray(machinesResponse) ? machinesResponse : []);
        setDowntimeReasons(Array.isArray(reasonsResponse) ? reasonsResponse : []);
        setDowntimeItems(Array.isArray(downtimesResponse) ? downtimesResponse : []);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setMachines([]);
        setDowntimeReasons([]);
        setDowntimeItems([]);
        setLoadError(
          toErrorMessage(
            error,
            "Не удалось загрузить журнал внеплановых простоев. Проверьте подключение к backend.",
          ),
        );
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadInitial();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleFilterChange = (field, value) => {
    setFilters((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  };

  const handleApplyFilters = async () => {
    await loadEquipmentDowntimes(filters);
  };

  const handleResetFilters = async () => {
    const clearedFilters = {
      machine_id: "",
      downtime_reason_id: "",
      reason_category: "",
      status: "",
      date_from: "",
      date_to: "",
    };

    setFilters(clearedFilters);
    await loadEquipmentDowntimes(clearedFilters);
  };

  const openCreateModal = () => {
    if (!canCreateDowntime) {
      setPageError("Недостаточно прав для изменения внепланового простоя.");
      return;
    }

    const defaultState = createDefaultFormState();

    setFormMode("create");
    setEditingItem(null);
    setFormError("");
    setFormState({
      ...defaultState,
      machine_id: machines[0]?.machine_id ? String(machines[0].machine_id) : "",
      downtime_reason_id: downtimeReasons[0]?.downtime_reason_id
        ? String(downtimeReasons[0].downtime_reason_id)
        : "",
    });
    setIsFormOpen(true);
  };

  const openEditModal = (item) => {
    if (!canEditDowntimeBase) {
      setPageError("Недостаточно прав для изменения внепланового простоя.");
      return;
    }

    const started = splitDateTime(item.started_at);
    const ended = splitDateTime(item.ended_at);

    setFormMode("edit");
    setEditingItem(item);
    setFormError("");
    setFormState({
      machine_id: item.machine_id ? String(item.machine_id) : "",
      downtime_reason_id: item.downtime_reason_id ? String(item.downtime_reason_id) : "",
      started_date: started.date,
      started_time: started.time || "00:00",
      ended_date: ended.date,
      ended_time: ended.time,
      comment: item.comment || "",
    });
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    if (isSaving) {
      return;
    }

    setFormError("");
    setIsFormOpen(false);
  };

  const openCloseModal = (item) => {
    if (!canEditDowntimeBase) {
      setPageError("Недостаточно прав для изменения внепланового простоя.");
      return;
    }

    setClosingItem(item);
    setCloseState(createDefaultCloseState(item));
    setCloseError("");
  };

  const closeCloseModal = () => {
    if (isClosing) {
      return;
    }

    setCloseError("");
    setClosingItem(null);
  };

  const handleSaveDowntime = async () => {
    if (!canSubmitDowntimeForm) {
      setFormError("Недостаточно прав для изменения внепланового простоя.");
      return;
    }

    if (!formState.machine_id) {
      setFormError("Оборудование обязательно.");
      return;
    }

    if (!formState.downtime_reason_id) {
      setFormError("Причина простоя обязательна.");
      return;
    }

    if (!formState.started_date || !formState.started_time) {
      setFormError("Дата и время начала обязательны.");
      return;
    }

    const hasEndDate = Boolean(formState.ended_date);
    const hasEndTime = Boolean(formState.ended_time);

    if (hasEndDate !== hasEndTime) {
      setFormError("Если указано окончание, заполните и дату, и время.");
      return;
    }

    if (hasEndDate && hasEndTime) {
      const startedAt = parseDateTime(formState.started_date, formState.started_time);
      const endedAt = parseDateTime(formState.ended_date, formState.ended_time);

      if (!startedAt || !endedAt || endedAt <= startedAt) {
        setFormError("Окончание простоя должно быть позже начала.");
        return;
      }
    }

    const payload = {
      machine_id: Number(formState.machine_id),
      downtime_reason_id: Number(formState.downtime_reason_id),
      started_at: buildApiDateTime(formState.started_date, formState.started_time),
      ended_at:
        hasEndDate && hasEndTime
          ? buildApiDateTime(formState.ended_date, formState.ended_time)
          : null,
      comment: String(formState.comment || "").trim() || null,
    };

    setIsSaving(true);
    setFormError("");
    setPageError("");

    try {
      if (formMode === "create") {
        await createEquipmentDowntime(payload);
      } else if (editingItem?.downtime_id) {
        await updateEquipmentDowntime(editingItem.downtime_id, payload);
      }

      setIsFormOpen(false);
      await loadEquipmentDowntimes(filters);
    } catch (error) {
      setFormError(toDowntimeWriteErrorMessage(error, "Не удалось сохранить запись простоя."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDowntime = async () => {
    if (!canEditDowntimeBase) {
      setCloseError("Недостаточно прав для изменения внепланового простоя.");
      return;
    }

    if (!closingItem?.downtime_id) {
      return;
    }

    if (!closeState.ended_date || !closeState.ended_time) {
      setCloseError("Дата и время окончания обязательны.");
      return;
    }

    const started = splitDateTime(closingItem.started_at);
    const startedAt = parseDateTime(started.date, started.time);
    const endedAt = parseDateTime(closeState.ended_date, closeState.ended_time);

    if (!startedAt || !endedAt || endedAt <= startedAt) {
      setCloseError("Окончание простоя должно быть позже начала.");
      return;
    }

    setIsClosing(true);
    setCloseError("");
    setPageError("");

    try {
      await closeEquipmentDowntime(closingItem.downtime_id, {
        ended_at: buildApiDateTime(closeState.ended_date, closeState.ended_time),
        comment: String(closeState.comment || "").trim() || null,
      });

      setClosingItem(null);
      await loadEquipmentDowntimes(filters);
    } catch (error) {
      setCloseError(toDowntimeWriteErrorMessage(error, "Не удалось закрыть простой."));
    } finally {
      setIsClosing(false);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteDowntimeBase) {
      setDeleteCandidate(null);
      setPageError("Недостаточно прав для изменения внепланового простоя.");
      return;
    }

    if (!deleteCandidate?.downtime_id) {
      return;
    }

    setIsDeleting(true);
    setPageError("");

    try {
      await deleteEquipmentDowntime(deleteCandidate.downtime_id);
      setDeleteCandidate(null);
      await loadEquipmentDowntimes(filters);
    } catch (error) {
      setDeleteCandidate(null);
      setPageError(toDowntimeWriteErrorMessage(error, "Не удалось удалить запись простоя."));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <section className="glass-panel p-4 sm:p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-64 rounded-none bg-slate-800/80" />
          <div className="h-4 w-96 rounded-none bg-slate-900/80" />
          <div className="h-56 rounded-none border border-dashed border-cyan-500/20 bg-slate-950/50" />
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="rounded-none border border-rose-500/40 bg-rose-950/20 p-5 text-sm text-rose-100">
        {loadError}
      </section>
    );
  }

  return (
    <>
      <section className="glass-panel space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 border-b border-cyan-500/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <h1 className="font-['Space_Grotesk'] text-3xl font-semibold text-slate-50 sm:text-4xl">
              Журнал внеплановых простоев оборудования
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-400">
              Внеплановые остановки оборудования независимо от причины простоя.
            </p>
            <div
              className={[
                "inline-flex items-center rounded-none border px-2.5 py-1 text-sm font-medium",
                openDowntimeCount > 0
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
                  : "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
              ].join(" ")}
            >
              Открытые простои: {openDowntimeCount}
            </div>
          </div>

          {canCreateDowntime ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center gap-2 rounded-none border border-cyan-300/35 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.22]"
            >
              <Plus className="h-4 w-4" />
              Добавить простой
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Оборудование</span>
            <select
              value={filters.machine_id}
              onChange={(event) => handleFilterChange("machine_id", event.target.value)}
              className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            >
              <option value="">Все</option>
              {machines.map((machine) => (
                <option key={machine.machine_id} value={machine.machine_id}>
                  {getMachineDisplay(machine.machine_code, machine.machine_name)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Причина простоя
            </span>
            <select
              value={filters.downtime_reason_id}
              onChange={(event) => handleFilterChange("downtime_reason_id", event.target.value)}
              className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            >
              <option value="">Все</option>
              {downtimeReasons.map((reason) => (
                <option key={reason.downtime_reason_id} value={reason.downtime_reason_id}>
                  {getReasonDisplay(reason.reason_code, reason.reason_name)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Категория причины
            </span>
            <select
              value={filters.reason_category}
              onChange={(event) => handleFilterChange("reason_category", event.target.value)}
              className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            >
              <option value="">Все</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Статус</span>
            <select
              value={filters.status}
              onChange={(event) => handleFilterChange("status", event.target.value)}
              className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Дата с</span>
            <input
              type="date"
              value={filters.date_from}
              onChange={(event) => handleFilterChange("date_from", event.target.value)}
              className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-300">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Дата по</span>
            <input
              type="date"
              value={filters.date_to}
              onChange={(event) => handleFilterChange("date_to", event.target.value)}
              className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleApplyFilters}
            className="h-10 rounded-none border border-cyan-300/35 bg-cyan-400/[0.12] px-4 text-sm text-cyan-50 transition hover:bg-cyan-400/[0.2]"
          >
            Применить фильтр
          </button>
          <button
            type="button"
            onClick={handleResetFilters}
            className="h-10 rounded-none border border-white/15 px-3 text-sm text-slate-200 transition hover:border-cyan-300/30"
          >
            Сбросить
          </button>
          <button
            type="button"
            onClick={() => loadEquipmentDowntimes(filters)}
            className="h-10 rounded-none border border-white/15 px-3 text-sm text-slate-200 transition hover:border-cyan-300/30"
          >
            Обновить
          </button>
        </div>

        {pageError ? (
          <div className="rounded-none border border-rose-500/40 bg-rose-950/20 px-3 py-2 text-sm text-rose-100">
            {pageError}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-none border border-cyan-300/10">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Статус</th>
                  <th className="px-3 py-2 text-left font-medium">Период</th>
                  <th className="px-3 py-2 text-left font-medium">Оборудование</th>
                  <th className="px-3 py-2 text-left font-medium">Длительность</th>
                  <th className="px-3 py-2 text-left font-medium">Причина</th>
                  <th className="px-3 py-2 text-left font-medium">Категория</th>
                  <th className="px-3 py-2 text-left font-medium">Автор</th>
                  <th className="px-3 py-2 text-left font-medium">Комментарий</th>
                  <th className="px-3 py-2 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {isListLoading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                      Загрузка журнала простоев...
                    </td>
                  </tr>
                ) : downtimeItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                      Нет записей по выбранным условиям.
                    </td>
                  </tr>
                ) : (
                  downtimeItems.map((item) => {
                    const isOpen = item.status === "open";

                    return (
                      <tr
                        key={item.downtime_id}
                        className="border-t border-white/[0.05] align-top hover:bg-cyan-300/[0.03]"
                      >
                        <td className="px-3 py-2.5">
                          <span
                            className={[
                              "inline-flex items-center rounded-none border px-2 py-1 text-xs font-medium",
                              isOpen
                                ? "border-amber-500/50 bg-amber-500/10 text-amber-100"
                                : "border-cyan-500/40 bg-cyan-500/10 text-cyan-100",
                            ].join(" ")}
                          >
                            {isOpen ? "Открыт" : "Закрыт"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          <div className="space-y-1 leading-5">
                            <div>{formatDateTime(item.started_at)}</div>
                            <div className="text-slate-500">
                              → {item.ended_at ? formatDateTime(item.ended_at) : "не закрыт"}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          <div className="space-y-0.5 leading-5">
                            <div className="font-medium text-slate-100">{item.machine_name || "—"}</div>
                            {item.machine_code ? (
                              <div className="text-xs text-slate-500">код: {item.machine_code}</div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          {isOpen
                            ? `${formatHours(item.current_duration_hours)} на текущий момент`
                            : formatHours(item.duration_hours)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">
                          <div className="space-y-0.5 leading-5">
                            <div className="font-medium text-slate-100">{item.reason_name || "—"}</div>
                            {item.reason_code ? (
                              <div className="text-xs text-slate-500">код: {item.reason_code}</div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">{item.reason_category || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-300">{item.created_by_username || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-400">{item.comment || "—"}</td>
                        <td className="px-3 py-2.5">
                          {canEditDowntimeBase || canDeleteDowntimeBase ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                title="Изменить"
                                aria-label="Изменить"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-cyan-300/28 bg-cyan-400/[0.08] text-cyan-100 transition hover:border-cyan-300/42 hover:bg-cyan-400/[0.16]"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {isOpen ? (
                                <button
                                  type="button"
                                  onClick={() => openCloseModal(item)}
                                  title="Закрыть простой"
                                  aria-label="Закрыть простой"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-amber-500/40 bg-amber-500/10 text-amber-100 transition hover:border-amber-400/60 hover:bg-amber-500/15"
                                >
                                  <CheckCheck className="h-4 w-4" />
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => setDeleteCandidate(item)}
                                title="Удалить"
                                aria-label="Удалить"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-rose-300/28 bg-rose-500/[0.08] text-rose-100 transition hover:border-rose-300/42 hover:bg-rose-500/[0.16]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="text-right text-slate-600">—</div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-3xl rounded-none border border-cyan-500/30 bg-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.05)]">
            <div className="border-b border-cyan-500/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-100">
                {formMode === "create" ? "Добавить простой" : "Изменить простой"}
              </h2>
            </div>

            <div className="space-y-4 px-5 py-4">
              {formError ? (
                <div className="rounded-none border border-rose-500/40 bg-rose-950/20 px-3 py-2 text-sm text-rose-100">
                  {formError}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-300">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Оборудование</span>
                  <select
                    value={formState.machine_id}
                    disabled={!canSubmitDowntimeForm}
                    onChange={(event) =>
                      setFormState((currentValue) => ({
                        ...currentValue,
                        machine_id: event.target.value,
                      }))
                    }
                    className="w-full rounded-none border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60"
                  >
                    <option value="">Выберите оборудование</option>
                    {machines.map((machine) => (
                      <option key={machine.machine_id} value={machine.machine_id}>
                        {getMachineDisplay(machine.machine_code, machine.machine_name)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm text-slate-300">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Причина простоя
                  </span>
                  <select
                    value={formState.downtime_reason_id}
                    disabled={!canSubmitDowntimeForm}
                    onChange={(event) =>
                      setFormState((currentValue) => ({
                        ...currentValue,
                        downtime_reason_id: event.target.value,
                      }))
                    }
                    className="w-full rounded-none border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60"
                  >
                    <option value="">Выберите причину</option>
                    {downtimeReasons.map((reason) => (
                      <option key={reason.downtime_reason_id} value={reason.downtime_reason_id}>
                        {getReasonDisplay(reason.reason_code, reason.reason_name)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-none border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">
                Категория: <span className="text-slate-100">{selectedReason?.reason_category || "—"}</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-none border border-slate-800 bg-slate-950/50 p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Начало простоя</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm text-slate-300">
                      <span>Дата начала</span>
                      <input
                        type="date"
                        value={formState.started_date}
                        readOnly={!canSubmitDowntimeForm}
                        disabled={!canSubmitDowntimeForm}
                        onChange={(event) =>
                          setFormState((currentValue) => ({
                            ...currentValue,
                            started_date: event.target.value,
                          }))
                        }
                        className="w-full rounded-none border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60"
                      />
                    </label>
                    <label className="space-y-1 text-sm text-slate-300">
                      <span>Время начала</span>
                      <select
                        value={formState.started_time}
                        disabled={!canSubmitDowntimeForm}
                        onChange={(event) =>
                          setFormState((currentValue) => ({
                            ...currentValue,
                            started_time: event.target.value,
                          }))
                        }
                        className="w-full rounded-none border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60"
                      >
                        {timeOptions.map((timeOption) => (
                          <option key={`start-${timeOption}`} value={timeOption}>
                            {timeOption}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="space-y-3 rounded-none border border-slate-800 bg-slate-950/50 p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Окончание простоя</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm text-slate-300">
                      <span>Дата окончания</span>
                      <input
                        type="date"
                        value={formState.ended_date}
                        readOnly={!canSubmitDowntimeForm}
                        disabled={!canSubmitDowntimeForm}
                        onChange={(event) =>
                          setFormState((currentValue) => ({
                            ...currentValue,
                            ended_date: event.target.value,
                          }))
                        }
                        className="w-full rounded-none border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60"
                      />
                    </label>
                    <label className="space-y-1 text-sm text-slate-300">
                      <span>Время окончания</span>
                      <select
                        value={formState.ended_time}
                        disabled={!canSubmitDowntimeForm}
                        onChange={(event) =>
                          setFormState((currentValue) => ({
                            ...currentValue,
                            ended_time: event.target.value,
                          }))
                        }
                        className="w-full rounded-none border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60"
                      >
                        <option value="">Не выбрано</option>
                        {timeOptions.map((timeOption) => (
                          <option key={`end-${timeOption}`} value={timeOption}>
                            {timeOption}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-none border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-50">
                {durationPreview}
              </div>

              <label className="space-y-1 text-sm text-slate-300">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Комментарий</span>
                <textarea
                  value={formState.comment}
                  readOnly={!canSubmitDowntimeForm}
                  disabled={!canSubmitDowntimeForm}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      comment: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-none border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60"
                />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-cyan-500/10 px-5 py-4">
              <button
                type="button"
                onClick={closeFormModal}
                className="rounded-none border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveDowntime}
                disabled={isSaving || !canSubmitDowntimeForm}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/50 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {closingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-2xl rounded-none border border-cyan-500/30 bg-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.05)]">
            <div className="border-b border-cyan-500/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-100">Закрыть простой</h2>
            </div>

            <div className="space-y-4 px-5 py-4">
              {closeError ? (
                <div className="rounded-none border border-rose-500/40 bg-rose-950/20 px-3 py-2 text-sm text-rose-100">
                  {closeError}
                </div>
              ) : null}

              <div className="grid gap-3 rounded-none border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
                <div>
                  Оборудование:{" "}
                  <span className="text-slate-100">
                    {getMachineDisplay(closingItem.machine_code, closingItem.machine_name)}
                  </span>
                </div>
                <div>
                  Начало простоя:{" "}
                  <span className="text-slate-100">{formatDateTime(closingItem.started_at)}</span>
                </div>
                <div>
                  Причина:{" "}
                  <span className="text-slate-100">
                    {getReasonDisplay(closingItem.reason_code, closingItem.reason_name)}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-300">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Дата окончания</span>
                  <input
                    type="date"
                    value={closeState.ended_date}
                    readOnly={!canEditDowntimeBase}
                    disabled={!canEditDowntimeBase}
                    onChange={(event) =>
                      setCloseState((currentValue) => ({
                        ...currentValue,
                        ended_date: event.target.value,
                      }))
                    }
                    className="w-full rounded-none border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-300">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Время окончания</span>
                  <select
                    value={closeState.ended_time}
                    disabled={!canEditDowntimeBase}
                    onChange={(event) =>
                      setCloseState((currentValue) => ({
                        ...currentValue,
                        ended_time: event.target.value,
                      }))
                    }
                    className="w-full rounded-none border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60"
                  >
                    <option value="">Выберите время</option>
                    {timeOptions.map((timeOption) => (
                      <option key={`close-${timeOption}`} value={timeOption}>
                        {timeOption}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-none border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-50">
                {closeDurationPreview}
              </div>

              <label className="space-y-1 text-sm text-slate-300">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Комментарий</span>
                <textarea
                  value={closeState.comment}
                  readOnly={!canEditDowntimeBase}
                  disabled={!canEditDowntimeBase}
                  onChange={(event) =>
                    setCloseState((currentValue) => ({
                      ...currentValue,
                      comment: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-none border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60"
                />
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-cyan-500/10 px-5 py-4">
              <button
                type="button"
                onClick={closeCloseModal}
                className="rounded-none border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleCloseDowntime}
                disabled={isClosing || !canEditDowntimeBase}
                className="inline-flex items-center gap-2 rounded-none border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100 transition hover:border-amber-400/60 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isClosing ? "Закрытие..." : "Закрыть простой"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <V2ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        title="Удалить запись простоя?"
        message="Запись будет удалена из журнала простоев оборудования."
        confirmText={isDeleting ? "Удаление..." : "Удалить"}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteCandidate(null);
          }
        }}
        onConfirm={handleDelete}
        confirmTone="danger"
      />
    </>
  );
}

export default EquipmentDowntimesSection;
