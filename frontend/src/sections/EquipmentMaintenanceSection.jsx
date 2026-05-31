import { AlertCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import V2ConfirmDialog from "../components/common/V2ConfirmDialog";
import {
  createEquipmentMaintenance,
  deleteEquipmentMaintenance,
  getEquipmentMaintenance,
  updateEquipmentMaintenance,
} from "../services/equipmentMaintenanceApi";
import { getMachinesList } from "../services/machinesApi";

function sortMachinesByCode(items) {
  return [...items].sort((left, right) =>
    String(left.machine_code || "").localeCompare(String(right.machine_code || ""), "ru"),
  );
}

function toErrorMessage(error, fallbackText) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackText;
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString("ru-RU");
}

function formatDurationHours(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "—";
  }
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number);
}

function splitDateTimeValue(value) {
  if (!value) {
    return {
      date: "",
      time: "",
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      date: "",
      time: "",
    };
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  const localDateTimeText = localDate.toISOString().slice(0, 16);
  return {
    date: localDateTimeText.slice(0, 10),
    time: localDateTimeText.slice(11, 16),
  };
}

function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return "";
  }
  return `${dateValue}T${timeValue}`;
}

function isValidTimeValue(value) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}

function buildHalfHourTimeOptions(extraValues = []) {
  const options = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 30]) {
      options.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }

  const extraTimes = [...new Set(extraValues.filter((value) => isValidTimeValue(value)))];
  extraTimes.forEach((value) => {
    if (!options.includes(value)) {
      options.push(value);
    }
  });

  return options.sort((left, right) => left.localeCompare(right));
}

function toDurationPreviewHours(startedAt, endedAt) {
  if (!startedAt || !endedAt) {
    return null;
  }
  const startDate = new Date(startedAt);
  const endDate = new Date(endedAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  const diffMinutes = Math.floor((endDate.getTime() - startDate.getTime()) / 60_000);
  if (diffMinutes <= 0) {
    return null;
  }
  return diffMinutes / 60;
}

function buildApiFilters(machineId, dateFrom, dateTo) {
  const filters = {};
  if (machineId) {
    filters.machine_id = Number(machineId);
  }
  if (dateFrom) {
    filters.date_from = `${dateFrom}T00:00:00`;
  }
  if (dateTo) {
    filters.date_to = `${dateTo}T23:59:59`;
  }
  return filters;
}

function EquipmentMaintenanceSection() {
  const [machines, setMachines] = useState([]);
  const [items, setItems] = useState([]);

  const [machineFilter, setMachineFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);
  const [formMachineId, setFormMachineId] = useState("");
  const [formStartedDate, setFormStartedDate] = useState("");
  const [formStartedTime, setFormStartedTime] = useState("");
  const [formEndedDate, setFormEndedDate] = useState("");
  const [formEndedTime, setFormEndedTime] = useState("");
  const [formComment, setFormComment] = useState("");
  const [formError, setFormError] = useState("");

  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const formStartedAt = useMemo(
    () => combineDateAndTime(formStartedDate, formStartedTime),
    [formStartedDate, formStartedTime],
  );
  const formEndedAt = useMemo(
    () => combineDateAndTime(formEndedDate, formEndedTime),
    [formEndedDate, formEndedTime],
  );

  const formTimeOptions = useMemo(
    () => buildHalfHourTimeOptions([formStartedTime, formEndedTime]),
    [formEndedTime, formStartedTime],
  );

  const durationPreviewHours = useMemo(
    () => toDurationPreviewHours(formStartedAt, formEndedAt),
    [formEndedAt, formStartedAt],
  );

  const loadMaintenance = useCallback(async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setLoadError("Дата «по» должна быть не раньше даты «с».");
      setItems([]);
      return;
    }

    setIsLoading(true);
    setLoadError("");

    try {
      const response = await getEquipmentMaintenance(buildApiFilters(machineFilter, dateFrom, dateTo));
      setItems(Array.isArray(response) ? response : []);
    } catch (error) {
      setItems([]);
      setLoadError(toErrorMessage(error, "Не удалось загрузить список плановых ТО."));
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, machineFilter]);

  useEffect(() => {
    let isCancelled = false;

    async function loadMachines() {
      try {
        const response = await getMachinesList();
        if (isCancelled) {
          return;
        }
        setMachines(sortMachinesByCode(Array.isArray(response) ? response : []));
      } catch {
        if (!isCancelled) {
          setMachines([]);
        }
      }
    }

    loadMachines();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    loadMaintenance();
  }, [loadMaintenance]);

  const openCreateModal = () => {
    const defaultMachineId = machineFilter || (machines[0] ? String(machines[0].machine_id) : "");

    setFormMode("create");
    setEditingItem(null);
    setFormMachineId(defaultMachineId);
    setFormStartedDate("");
    setFormStartedTime("");
    setFormEndedDate("");
    setFormEndedTime("");
    setFormComment("");
    setFormError("");
    setActionError("");
    setIsFormOpen(true);
  };

  const openEditModal = (item) => {
    const startedParts = splitDateTimeValue(item.started_at);
    const endedParts = splitDateTimeValue(item.ended_at);

    setFormMode("edit");
    setEditingItem(item);
    setFormMachineId(String(item.machine_id));
    setFormStartedDate(startedParts.date);
    setFormStartedTime(startedParts.time);
    setFormEndedDate(endedParts.date);
    setFormEndedTime(endedParts.time);
    setFormComment(item.comment || "");
    setFormError("");
    setActionError("");
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    if (isSaving) {
      return;
    }
    setIsFormOpen(false);
    setFormError("");
  };

  const handleSave = async () => {
    if (!formMachineId) {
      setFormError("Выберите оборудование.");
      return;
    }

    if (!formStartedDate || !formStartedTime || !formEndedDate || !formEndedTime) {
      setFormError("Заполните начало и окончание ТО.");
      return;
    }

    const nextStartedAt = combineDateAndTime(formStartedDate, formStartedTime);
    const nextEndedAt = combineDateAndTime(formEndedDate, formEndedTime);

    const startDate = new Date(nextStartedAt);
    const endDate = new Date(nextEndedAt);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setFormError("Проверьте формат даты и времени.");
      return;
    }
    if (endDate <= startDate) {
      setFormError("Окончание ТО должно быть позже начала.");
      return;
    }

    const payload = {
      machine_id: Number(formMachineId),
      started_at: nextStartedAt,
      ended_at: nextEndedAt,
      comment: formComment.trim() || null,
    };

    setIsSaving(true);
    setFormError("");
    setActionError("");

    try {
      if (formMode === "edit" && editingItem?.maintenance_id) {
        await updateEquipmentMaintenance(editingItem.maintenance_id, payload);
      } else {
        await createEquipmentMaintenance(payload);
      }

      setIsFormOpen(false);
      await loadMaintenance();
    } catch (error) {
      setFormError(toErrorMessage(error, "Не удалось сохранить плановое ТО."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate?.maintenance_id) {
      setDeleteCandidate(null);
      return;
    }

    const deletingId = deleteCandidate.maintenance_id;
    setIsDeleting(true);
    setActionError("");
    setDeleteCandidate(null);

    try {
      await deleteEquipmentMaintenance(deletingId);
      await loadMaintenance();
    } catch (error) {
      setActionError(toErrorMessage(error, "Не удалось удалить плановое ТО."));
    } finally {
      setIsDeleting(false);
      setDeleteCandidate(null);
    }
  };

  return (
    <section className="space-y-5">
      <header className="glass-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <h1 className="font-['Space_Grotesk'] text-3xl font-semibold text-slate-50 sm:text-4xl">
              Плановое ТО
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Плановые интервалы недоступности оборудования для расчёта доступности в
              недельном плане.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-11 items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
          >
            <Plus className="h-4 w-4" />
            Добавить ТО
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Оборудование</div>
            <select
              value={machineFilter}
              onChange={(event) => {
                setActionError("");
                setMachineFilter(event.target.value);
              }}
              className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            >
              <option value="">Все</option>
              {machines.map((machine) => (
                <option key={machine.machine_id} value={machine.machine_id}>
                  {machine.machine_code} — {machine.machine_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Дата с</div>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setActionError("");
                setDateFrom(event.target.value);
              }}
              className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            />
          </div>

          <div>
            <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Дата по</div>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setActionError("");
                setDateTo(event.target.value);
              }}
              className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            />
          </div>
        </div>

        {loadError ? (
          <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        ) : null}

        {actionError ? (
          <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        ) : null}
      </header>

      <section className="glass-panel p-5 sm:p-6">
        {isLoading ? (
          <div className="text-sm text-slate-400">Загружаем плановые ТО...</div>
        ) : items.length === 0 ? (
          <div className="rounded-none border border-white/[0.08] bg-white/[0.02] px-4 py-5 text-sm text-slate-400">
            Записи планового ТО не найдены.
          </div>
        ) : (
          <div className="overflow-hidden rounded-none border border-cyan-300/10">
            <div className="max-h-[560px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-[11px] uppercase tracking-[0.08em] text-slate-500">
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
                  {items.map((item) => (
                    <tr
                      key={item.maintenance_id}
                      className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]"
                    >
                      <td className="px-3 py-2.5 text-slate-100">
                        <div className="font-medium">{item.machine_code}</div>
                        <div className="text-xs text-slate-400">{item.machine_name}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300">{formatDateTime(item.started_at)}</td>
                      <td className="px-3 py-2.5 text-slate-300">{formatDateTime(item.ended_at)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">
                        {formatDurationHours(item.duration_hours)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">{item.comment || "—"}</td>
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
                            onClick={() => {
                              setActionError("");
                              setDeleteCandidate(item);
                            }}
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-none border border-cyan-300/20 bg-[rgba(10,24,36,0.98)] p-5 shadow-[0_22px_80px_rgba(6,10,14,0.65)]">
            <div className="panel-title">
              {formMode === "edit" ? "Редактирование планового ТО" : "Новое плановое ТО"}
            </div>
            <h2 className="mt-3 font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">
              {formMode === "edit" ? "Изменить плановое ТО" : "Добавить плановое ТО"}
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Оборудование</div>
                <select
                  value={formMachineId}
                  onChange={(event) => setFormMachineId(event.target.value)}
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                >
                  <option value="">Выберите оборудование</option>
                  {machines.map((machine) => (
                    <option key={machine.machine_id} value={machine.machine_id}>
                      {machine.machine_code} — {machine.machine_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Дата начала</div>
                <input
                  type="date"
                  value={formStartedDate}
                  onChange={(event) => setFormStartedDate(event.target.value)}
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </div>

              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Время начала</div>
                <select
                  value={formStartedTime}
                  onChange={(event) => setFormStartedTime(event.target.value)}
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                >
                  <option value="">Выберите время</option>
                  {formTimeOptions.map((timeValue) => (
                    <option key={`start-${timeValue}`} value={timeValue}>
                      {timeValue}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Дата окончания</div>
                <input
                  type="date"
                  value={formEndedDate}
                  onChange={(event) => setFormEndedDate(event.target.value)}
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </div>

              <div>
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Время окончания</div>
                <select
                  value={formEndedTime}
                  onChange={(event) => setFormEndedTime(event.target.value)}
                  className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                >
                  <option value="">Выберите время</option>
                  {formTimeOptions.map((timeValue) => (
                    <option key={`end-${timeValue}`} value={timeValue}>
                      {timeValue}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <div className="rounded-none border border-cyan-300/20 bg-cyan-400/[0.06] px-3 py-2 text-sm text-cyan-100">
                  Длительность:{" "}
                  {durationPreviewHours === null ? "—" : `${formatDurationHours(durationPreviewHours)} ч`}
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Комментарий</div>
                <textarea
                  rows={4}
                  value={formComment}
                  onChange={(event) => setFormComment(event.target.value)}
                  className="w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </div>
            </div>

            {formError ? (
              <div className="mt-4 flex items-start gap-2 border border-rose-300/30 bg-rose-500/[0.1] px-3 py-2 text-sm text-rose-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
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
                onClick={handleSave}
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
        title="Удалить плановое ТО?"
        message={
          deleteCandidate
            ? `Запись ТО для оборудования ${deleteCandidate.machine_code} будет удалена.`
            : ""
        }
        confirmText={isDeleting ? "Удаляем..." : "Удалить"}
        cancelText="Отмена"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteCandidate(null)}
        isConfirmDisabled={isDeleting}
        isCancelDisabled={isDeleting}
      />
    </section>
  );
}

export default EquipmentMaintenanceSection;
