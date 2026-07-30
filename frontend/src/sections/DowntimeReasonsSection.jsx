import { AlertCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useRole } from "../auth/useRole";
import V2ConfirmDialog from "../components/common/V2ConfirmDialog";
import {
  createDowntimeReason,
  deleteDowntimeReason,
  getDowntimeReasons,
  updateDowntimeReason,
} from "../services/downtimeReasonsApi";

const CATEGORY_OPTIONS = [
  "Оборудование",
  "Материалы",
  "Персонал",
  "Технология / качество",
  "Организация производства",
  "Энергоресурсы",
  "Прочее",
];

function toErrorMessage(error, fallbackText) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackText;
}

function DowntimeReasonsSection() {
  const { user } = useRole();
  const [reasonItems, setReasonItems] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    reason_category: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [loadError, setLoadError] = useState("");
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const canEditDowntimeReasons =
    user?.role === "admin" || user?.role === "demo_admin" || user?.role === "planner" || user?.role === "maintenance";

  const [formState, setFormState] = useState({
    reason_code: "",
    reason_name: "",
    reason_category: CATEGORY_OPTIONS[0],
    comment: "",
  });

  const loadDowntimeReasons = async (nextFilters = filters, options = { showLoader: true }) => {
    const shouldShowLoader = options.showLoader !== false;
    if (shouldShowLoader) {
      setIsListLoading(true);
    }
    setPageError("");

    try {
      const items = await getDowntimeReasons(nextFilters);
      setReasonItems(Array.isArray(items) ? items : []);
    } catch (error) {
      setReasonItems([]);
      setPageError(toErrorMessage(error, "Не удалось загрузить причины простоев."));
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
        const items = await getDowntimeReasons();
        if (isCancelled) {
          return;
        }
        setReasonItems(Array.isArray(items) ? items : []);
      } catch (error) {
        if (isCancelled) {
          return;
        }
        setReasonItems([]);
        setLoadError(
          toErrorMessage(
            error,
            "Не удалось загрузить справочник причин простоев. Проверьте подключение к backend.",
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
    await loadDowntimeReasons(filters);
  };

  const handleResetFilters = async () => {
    const clearedFilters = {
      search: "",
      reason_category: "",
    };
    setFilters(clearedFilters);
    await loadDowntimeReasons(clearedFilters);
  };

  const openCreateModal = () => {
    if (!canEditDowntimeReasons) {
      setPageError("Недостаточно прав для изменения причин простоев.");
      return;
    }

    setFormMode("create");
    setEditingItem(null);
    setFormError("");
    setFormState({
      reason_code: "",
      reason_name: "",
      reason_category: CATEGORY_OPTIONS[0],
      comment: "",
    });
    setIsFormOpen(true);
  };

  const openEditModal = (item) => {
    if (!canEditDowntimeReasons) {
      setPageError("Недостаточно прав для изменения причин простоев.");
      return;
    }

    setFormMode("edit");
    setEditingItem(item);
    setFormError("");
    setFormState({
      reason_code: item.reason_code || "",
      reason_name: item.reason_name || "",
      reason_category: item.reason_category || CATEGORY_OPTIONS[0],
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

  const handleSaveReason = async () => {
    const reasonCode = String(formState.reason_code || "").trim();
    const reasonName = String(formState.reason_name || "").trim();
    const reasonCategory = String(formState.reason_category || "").trim();

    if (!reasonCode) {
      setFormError("Код причины обязателен.");
      return;
    }

    if (!reasonName) {
      setFormError("Наименование причины обязательно.");
      return;
    }

    if (!reasonCategory) {
      setFormError("Категория причины обязательна.");
      return;
    }

    const payload = {
      reason_code: reasonCode,
      reason_name: reasonName,
      reason_category: reasonCategory,
      comment: String(formState.comment || "").trim() || null,
    };

    setIsSaving(true);
    setFormError("");
    setPageError("");

    try {
      if (formMode === "create") {
        await createDowntimeReason(payload);
      } else if (editingItem?.downtime_reason_id) {
        await updateDowntimeReason(editingItem.downtime_reason_id, payload);
      }

      setIsFormOpen(false);
      await loadDowntimeReasons(filters);
    } catch (error) {
      setFormError(
        error?.status === 403 || error?.message === "Forbidden"
          ? "Недостаточно прав для изменения причин простоев."
          : toErrorMessage(error, "Не удалось сохранить причину простоя."),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReason = async () => {
    if (!deleteCandidate?.downtime_reason_id) {
      return;
    }

    setIsDeleting(true);
    setPageError("");

    try {
      await deleteDowntimeReason(deleteCandidate.downtime_reason_id);
      setDeleteCandidate(null);
      await loadDowntimeReasons(filters);
    } catch (error) {
      setDeleteCandidate(null);
      setPageError(
        error?.status === 403 || error?.message === "Forbidden"
          ? "Недостаточно прав для изменения причин простоев."
          : toErrorMessage(error, "Не удалось удалить причину простоя."),
      );
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
              Причины простоев
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Справочник причин для будущего журнала внеплановых простоев оборудования.
            </p>
          </div>

          {canEditDowntimeReasons ? (
            <button
              type="button"
              onClick={openCreateModal}
              disabled={isLoading}
              className="inline-flex h-10 items-center gap-2 rounded-none border border-cyan-300/35 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.22] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Добавить причину
            </button>
          ) : null}
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
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr_auto]">
          <div>
            <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Поиск</div>
            <div className="flex h-10 items-center rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => handleFilterChange("search", event.target.value)}
                placeholder="Код, наименование или комментарий..."
                className="w-full bg-transparent pl-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs tracking-[0.08em] text-slate-500">Категория</div>
            <select
              value={filters.reason_category}
              onChange={(event) => handleFilterChange("reason_category", event.target.value)}
              className="h-10 w-full rounded-none border border-white/[0.1] bg-[rgba(8,22,34,0.74)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            >
              <option value="">Все</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
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
        <h2 className="text-xl font-semibold tracking-tight text-slate-50">Справочник причин</h2>
        {isLoading || isListLoading ? (
          <div className="mt-4 text-sm text-slate-300">Загружаем причины простоев...</div>
        ) : reasonItems.length === 0 ? (
          <div className="mt-4 text-sm text-slate-400">Причины простоев пока не добавлены.</div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10">
            <div className="max-h-[580px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Код</th>
                    <th className="px-3 py-2 text-left font-medium">Наименование</th>
                    <th className="px-3 py-2 text-left font-medium">Категория</th>
                    <th className="px-3 py-2 text-left font-medium">Комментарий</th>
                    {canEditDowntimeReasons ? (
                      <th className="px-3 py-2 text-right font-medium">Действия</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {reasonItems.map((item) => (
                    <tr
                      key={item.downtime_reason_id}
                      className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]"
                    >
                      <td className="px-3 py-2.5 font-medium text-slate-100">{item.reason_code}</td>
                      <td className="px-3 py-2.5 text-slate-300">{item.reason_name}</td>
                      <td className="px-3 py-2.5 text-slate-300">{item.reason_category}</td>
                      <td className="px-3 py-2.5 text-slate-300">{item.comment || "—"}</td>
                      {canEditDowntimeReasons ? (
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
                              className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-rose-300/28 bg-rose-500/[0.08] text-rose-100 transition hover:border-rose-300/42 hover:bg-rose-500/[0.16]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="glass-panel w-full max-w-3xl p-5 sm:p-6">
            <div className="panel-title">
              {formMode === "create" ? "Добавление" : "Редактирование"}
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-slate-50">
              {formMode === "create" ? "Добавить причину простоя" : "Редактировать причину простоя"}
            </h3>

            <div className="panel-divider mt-5" />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Код</div>
                <input
                  type="text"
                  value={formState.reason_code}
                  readOnly={!canEditDowntimeReasons}
                  disabled={!canEditDowntimeReasons}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      reason_code: event.target.value,
                    }))
                  }
                  className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                />
              </div>

              <div>
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Категория</div>
                <select
                  value={formState.reason_category}
                  disabled={!canEditDowntimeReasons}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      reason_category: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                >
                  {CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Наименование</div>
                <input
                  type="text"
                  value={formState.reason_name}
                  readOnly={!canEditDowntimeReasons}
                  disabled={!canEditDowntimeReasons}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      reason_name: event.target.value,
                    }))
                  }
                  className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Комментарий</div>
                <textarea
                  rows={4}
                  value={formState.comment}
                  readOnly={!canEditDowntimeReasons}
                  disabled={!canEditDowntimeReasons}
                  onChange={(event) =>
                    setFormState((currentValue) => ({
                      ...currentValue,
                      comment: event.target.value,
                    }))
                  }
                  className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                />
              </div>
            </div>

            {formError ? (
              <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeFormModal}
                disabled={isSaving}
                className="inline-flex items-center rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveReason}
                disabled={isSaving || !canEditDowntimeReasons}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <V2ConfirmDialog
        isOpen={Boolean(deleteCandidate)}
        title="Удалить причину простоя?"
        message="Причина будет удалена из справочника. Если по ней уже есть факты простоев, удаление будет запрещено."
        confirmText={isDeleting ? "Удаляем..." : "Удалить"}
        cancelText="Отмена"
        isConfirmDisabled={isDeleting}
        isCancelDisabled={isDeleting}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteCandidate(null);
          }
        }}
        onConfirm={handleDeleteReason}
      />
    </section>
  );
}

export default DowntimeReasonsSection;
