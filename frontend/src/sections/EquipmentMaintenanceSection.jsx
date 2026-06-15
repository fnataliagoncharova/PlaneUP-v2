import { AlertCircle, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import V2ConfirmDialog from "../components/common/V2ConfirmDialog";
import {
  createEquipmentMaintenance,
  deleteEquipmentMaintenance,
  getEquipmentMaintenance,
  printMaintenanceSchedule,
  updateEquipmentMaintenance,
} from "../services/equipmentMaintenanceApi";
import { getMachinesList } from "../services/machinesApi";

const BASE_TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${String(hours).padStart(2, "0")}:${minutes}`;
});

function toErrorMessage(error, fallbackText) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackText;
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

function formatDateInputValue(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthPeriod() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    date_from: formatDateInputValue(monthStart),
    date_to: formatDateInputValue(monthEnd),
  };
}

function getPrintPeriod(filters) {
  const defaultPeriod = getCurrentMonthPeriod();
  return {
    date_from: filters.date_from || defaultPeriod.date_from,
    date_to: filters.date_to || defaultPeriod.date_to,
  };
}

function buildMaintenanceScheduleFileName(dateFrom, dateTo) {
  return `График_ТО_оборудования_${dateFrom}_${dateTo}.xlsx`;
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

  return parsedDate.toLocaleString("ru-RU");
}

function toFiniteNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatHours(value, maximumFractionDigits = 2) {
  const number = toFiniteNumber(value);
  if (number === null) {
    return "—";
  }

  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(number);
}

function buildTimeOptions(currentStartTime, currentEndTime) {
  const optionsSet = new Set(BASE_TIME_OPTIONS);

  [currentStartTime, currentEndTime].forEach((value) => {
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

function EquipmentMaintenanceSection() {
  const [machines, setMachines] = useState([]);
  const [maintenanceItems, setMaintenanceItems] = useState([]);
  const [filters, setFilters] = useState({
    machine_id: "",
    date_from: "",
    date_to: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const [formState, setFormState] = useState({
    machine_id: "",
    started_date: "",
    started_time: "00:00",
    ended_date: "",
    ended_time: "00:30",
    comment: "",
  });

  const timeOptions = useMemo(
    () => buildTimeOptions(formState.started_time, formState.ended_time),
    [formState.started_time, formState.ended_time],
  );

  const durationText = useMemo(() => {
    const startedAt = parseDateTime(formState.started_date, formState.started_time);
    const endedAt = parseDateTime(formState.ended_date, formState.ended_time);

    if (!startedAt || !endedAt || endedAt <= startedAt) {
      return "Длительность: —";
    }

    const hours = (endedAt.getTime() - startedAt.getTime()) / 1000 / 60 / 60;
    return `Длительность: ${formatHours(hours)} ч`;
  }, [
    formState.ended_date,
    formState.ended_time,
    formState.started_date,
    formState.started_time,
  ]);

  const loadMaintenance = async (nextFilters = filters, options = { showLoader: true }) => {
    const shouldShowLoader = options.showLoader !== false;

    if (shouldShowLoader) {
      setIsListLoading(true);
    }
    setPageError("");

    try {
      const items = await getEquipmentMaintenance(nextFilters);
      setMaintenanceItems(Array.isArray(items) ? items : []);
    } catch (error) {
      setMaintenanceItems([]);
      setPageError(toErrorMessage(error, "Не удалось загрузить записи планового ТО."));
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
        const [machinesResponse, maintenanceResponse] = await Promise.all([
          getMachinesList(),
          getEquipmentMaintenance(),
        ]);

        if (isCancelled) {
          return;
        }

        setMachines(Array.isArray(machinesResponse) ? machinesResponse : []);
        setMaintenanceItems(Array.isArray(maintenanceResponse) ? maintenanceResponse : []);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setMachines([]);
        setMaintenanceItems([]);
        setLoadError(
          toErrorMessage(
            error,
            "Не удалось загрузить данные раздела планового ТО. Проверьте подключение к backend.",
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
    await loadMaintenance(filters);
  };

  const handleResetFilters = async () => {
    const clearedFilters = {
      machine_id: "",
      date_from: "",
      date_to: "",
    };
    setFilters(clearedFilters);
    await loadMaintenance(clearedFilters);
  };

  const openCreateModal = () => {
    const defaultMachineId =
      String(filters.machine_id || "").trim() || String(machines[0]?.machine_id || "");

    setFormMode("create");
    setEditingItem(null);
    setFormError("");
    setFormState({
      machine_id: defaultMachineId,
      started_date: "",
      started_time: "00:00",
      ended_date: "",
      ended_time: "00:30",
      comment: "",
    });
    setIsFormOpen(true);
  };

  const openEditModal = (item) => {
    const started = splitDateTime(item.started_at);
    const ended = splitDateTime(item.ended_at);

    setFormMode("edit");
    setEditingItem(item);
    setFormError("");
    setFormState({
      machine_id: String(item.machine_id ?? ""),
      started_date: started.date,
      started_time: started.time || "00:00",
      ended_date: ended.date,
      ended_time: ended.time || "00:30",
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

  const handleSaveMaintenance = async () => {
    const machineId = Number(formState.machine_id);
    if (!Number.isFinite(machineId) || machineId <= 0) {
      setFormError("Выберите оборудование.");
      return;
    }

    if (
      !formState.started_date ||
      !formState.started_time ||
      !formState.ended_date ||
      !formState.ended_time
    ) {
      setFormError("Заполните дату и время начала и окончания ТО.");
      return;
    }

    const startedAtDate = parseDateTime(formState.started_date, formState.started_time);
    const endedAtDate = parseDateTime(formState.ended_date, formState.ended_time);
    if (!startedAtDate || !endedAtDate) {
      setFormError("Некорректные дата или время.");
      return;
    }

    if (endedAtDate <= startedAtDate) {
      setFormError("Окончание ТО должно быть позже начала.");
      return;
    }

    const payload = {
      machine_id: machineId,
      started_at: buildApiDateTime(formState.started_date, formState.started_time),
      ended_at: buildApiDateTime(formState.ended_date, formState.ended_time),
      comment: String(formState.comment || "").trim() || null,
    };

    setIsSaving(true);
    setFormError("");
    setPageError("");

    try {
      if (formMode === "create") {
        await createEquipmentMaintenance(payload);
      } else if (editingItem?.maintenance_id) {
        await updateEquipmentMaintenance(editingItem.maintenance_id, payload);
      }

      setIsFormOpen(false);
      await loadMaintenance(filters);
    } catch (error) {
      setFormError(toErrorMessage(error, "Не удалось сохранить запись планового ТО."));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintSchedule = async () => {
    const printPeriod = getPrintPeriod(filters);
    if (printPeriod.date_from > printPeriod.date_to) {
      setPageError("Дата окончания периода печати не может быть раньше даты начала.");
      return;
    }

    setIsPrinting(true);
    setPageError("");
    try {
      const blob = await printMaintenanceSchedule(printPeriod.date_from, printPeriod.date_to);
      downloadBlob(blob, buildMaintenanceScheduleFileName(printPeriod.date_from, printPeriod.date_to));
    } catch (error) {
      setPageError(toErrorMessage(error, "Не удалось сформировать печатную форму графика ТО."));
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCandidate?.maintenance_id) {
      return;
    }

    setIsDeleting(true);
    setPageError("");

    try {
      await deleteEquipmentMaintenance(deleteCandidate.maintenance_id);
      setDeleteCandidate(null);
      await loadMaintenance(filters);
    } catch (error) {
      setDeleteCandidate(null);
      setPageError(toErrorMessage(error, "Не удалось удалить запись планового ТО."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="glass-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <h1 className="font-['Space_Grotesk'] text-3xl font-semibold text-slate-50 sm:text-4xl">
              Плановое ТО
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Плановые интервалы недоступности оборудования для расчёта доступности в недельном
              плане.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            title="Печать графика ТО"
            onClick={handlePrintSchedule}
            disabled={isLoading || isPrinting}
            className="inline-flex h-10 items-center gap-2 rounded-none border border-white/15 px-4 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/35 disabled:opacity-60"
          >
            <Printer className="h-4 w-4" />
            {isPrinting ? "Формируем..." : "Печать"}
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            disabled={isLoading}
            className="inline-flex h-10 items-center gap-2 rounded-none border border-cyan-300/35 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.22] disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Добавить ТО
          </button>
          </div>
        </div>

        {loadError ? (
          <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        ) : null}
        {pageError ? (
          <div className="mt-3 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{pageError}</span>
          </div>
        ) : null}
      </header>

      <section className="glass-panel p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.15fr_1fr_1fr_auto]">
          <div>
            <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Оборудование</div>
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
          </div>
          <div>
            <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Дата с</div>
            <input
              type="date"
              value={filters.date_from}
              onChange={(event) => handleFilterChange("date_from", event.target.value)}
              className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            />
          </div>
          <div>
            <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Дата по</div>
            <input
              type="date"
              value={filters.date_to}
              onChange={(event) => handleFilterChange("date_to", event.target.value)}
              className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={handleApplyFilters}
              disabled={isLoading || isListLoading}
              className="h-10 rounded-none border border-cyan-300/35 bg-cyan-400/[0.12] px-4 text-sm text-cyan-50 transition hover:bg-cyan-400/[0.2] disabled:opacity-60"
            >
              Применить
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={isLoading || isListLoading}
              className="h-10 rounded-none border border-white/15 px-3 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-60"
            >
              Сброс
            </button>
          </div>
        </div>
      </section>

      <section className="glass-panel p-4 sm:p-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-50">Список планового ТО</h2>
        {isLoading || isListLoading ? (
          <div className="mt-4 text-sm text-slate-300">Загружаем записи...</div>
        ) : maintenanceItems.length === 0 ? (
          <div className="mt-4 text-sm text-slate-400">Записей планового ТО пока нет.</div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10">
            <div className="max-h-[580px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Станок</th>
                    <th className="px-3 py-2 text-left font-medium">Начало</th>
                    <th className="px-3 py-2 text-left font-medium">Окончание</th>
                    <th className="px-3 py-2 text-right font-medium">Длительность, ч</th>
                    <th className="px-3 py-2 text-left font-medium">Комментарий</th>
                    <th className="px-3 py-2 text-right font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceItems.map((item) => (
                    <tr
                      key={item.maintenance_id}
                      className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]"
                    >
                      <td className="px-3 py-2.5 text-slate-100">
                        {getMachineDisplay(item.machine_code, item.machine_name)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">{formatDateTime(item.started_at)}</td>
                      <td className="px-3 py-2.5 text-slate-300">{formatDateTime(item.ended_at)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">
                        {formatHours(item.duration_hours)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">{item.comment || "—"}</td>
                      <td className="px-3 py-2.5">
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
                          <button
                            type="button"
                            onClick={() => setDeleteCandidate(item)}
                            title="Удалить"
                            aria-label="Удалить"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-rose-300/30 bg-rose-500/[0.1] text-rose-100 transition hover:border-rose-300/45 hover:bg-rose-500/[0.18]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-3xl rounded-none border border-cyan-300/20 bg-[rgba(10,24,36,0.98)] p-5 shadow-[0_22px_80px_rgba(6,10,14,0.65)]">
            <div className="text-lg font-semibold text-slate-50">
              {formMode === "create" ? "Добавить плановое ТО" : "Изменить плановое ТО"}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Оборудование</div>
                <select
                  value={formState.machine_id}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      machine_id: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                >
                  <option value="">Выберите оборудование</option>
                  {machines.map((machine) => (
                    <option key={machine.machine_id} value={machine.machine_id}>
                      {getMachineDisplay(machine.machine_code, machine.machine_name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Дата начала</div>
                <input
                  type="date"
                  value={formState.started_date}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      started_date: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </div>
              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Время начала</div>
                <select
                  value={formState.started_time}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      started_time: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                >
                  {timeOptions.map((timeOption) => (
                    <option key={`started-${timeOption}`} value={timeOption}>
                      {timeOption}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Дата окончания</div>
                <input
                  type="date"
                  value={formState.ended_date}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      ended_date: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </div>
              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Время окончания</div>
                <select
                  value={formState.ended_time}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      ended_time: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                >
                  {timeOptions.map((timeOption) => (
                    <option key={`ended-${timeOption}`} value={timeOption}>
                      {timeOption}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Комментарий</div>
                <textarea
                  value={formState.comment}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      comment: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </div>
            </div>

            <div className="mt-3 text-sm text-cyan-100">{durationText}</div>
            {formError ? <div className="mt-3 text-sm text-rose-200">{formError}</div> : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeFormModal}
                disabled={isSaving}
                className="h-9 rounded-none border border-white/15 px-4 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveMaintenance}
                disabled={isSaving}
                className="h-9 rounded-none border border-cyan-300/35 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.24] disabled:opacity-50"
              >
                {isSaving ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <V2ConfirmDialog
        open={Boolean(deleteCandidate)}
        title="Удалить запись планового ТО?"
        message={
          deleteCandidate
            ? `Запись ${getMachineDisplay(deleteCandidate.machine_code, deleteCandidate.machine_name)} будет удалена.`
            : ""
        }
        confirmText={isDeleting ? "Удаляем..." : "Удалить"}
        cancelText="Отмена"
        onConfirm={handleDelete}
        onCancel={() => setDeleteCandidate(null)}
        isConfirmDisabled={isDeleting}
        isCancelDisabled={isDeleting}
      />
    </section>
  );
}

export default EquipmentMaintenanceSection;
