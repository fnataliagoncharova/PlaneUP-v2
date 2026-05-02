import { AlertCircle, CheckCircle2, Lock, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import V2ConfirmDialog from "../components/common/V2ConfirmDialog";
import NomenclatureSearchSelect from "../components/shared/NomenclatureSearchSelect";
import { getNomenclatureList } from "../services/nomenclatureApi";
import {
  addProductionPlanLine,
  approveProductionPlan,
  createProductionPlan,
  deleteProductionPlan,
  deleteProductionPlanLine,
  getProductionPlan,
  getProductionPlans,
  returnProductionPlanToDraft,
  updateProductionPlan,
  updateProductionPlanLine,
} from "../services/productionPlansApi";

const PANEL_MODE_CONTEXT = "context";
const PANEL_MODE_CREATE_PLAN = "create_plan";
const PANEL_MODE_EDIT_PLAN = "edit_plan";
const PANEL_MODE_CREATE_LINE = "create_line";
const PANEL_MODE_EDIT_LINE = "edit_line";

function getCurrentMonthValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
}

function monthToApiDate(monthValue) {
  if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) {
    return "";
  }
  return `${monthValue}-01`;
}

function formatPlanMonth(dateValue) {
  if (!dateValue) {
    return "—";
  }
  return String(dateValue).slice(0, 7);
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

function getStatusLabel(status) {
  return status === "approved" ? "Утверждён" : "Черновик";
}

function getStatusBadgeClass(status) {
  if (status === "approved") {
    return "border-emerald-300/25 bg-emerald-400/[0.10] text-emerald-100";
  }
  return "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100";
}

function toErrorMessage(error, fallbackText) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallbackText;
}

function ProductionPlanningSection() {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [isPlansLoading, setIsPlansLoading] = useState(false);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusChanging, setIsStatusChanging] = useState(false);

  const [plansError, setPlansError] = useState("");
  const [planError, setPlanError] = useState("");
  const [formError, setFormError] = useState("");
  const [statusSuccess, setStatusSuccess] = useState("");

  const [panelMode, setPanelMode] = useState(PANEL_MODE_CONTEXT);
  const [lineEditItem, setLineEditItem] = useState(null);

  const [nomenclatureItems, setNomenclatureItems] = useState([]);
  const [isNomenclatureLoading, setIsNomenclatureLoading] = useState(false);

  const [createMonth, setCreateMonth] = useState(getCurrentMonthValue());
  const [createPlanName, setCreatePlanName] = useState("");
  const [createComment, setCreateComment] = useState("");

  const [editPlanName, setEditPlanName] = useState("");
  const [editPlanComment, setEditPlanComment] = useState("");

  const [lineNomenclatureId, setLineNomenclatureId] = useState("");
  const [lineQty, setLineQty] = useState("");
  const [linePriority, setLinePriority] = useState(false);
  const [linePriorityNote, setLinePriorityNote] = useState("");
  const [lineComment, setLineComment] = useState("");

  const [planDeleteCandidate, setPlanDeleteCandidate] = useState(null);
  const [lineDeleteCandidate, setLineDeleteCandidate] = useState(null);
  const [approveCandidate, setApproveCandidate] = useState(null);
  const [returnDraftCandidate, setReturnDraftCandidate] = useState(null);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [deletingLine, setDeletingLine] = useState(false);

  const manufacturedNomenclature = useMemo(
    () => nomenclatureItems.filter((item) => item.item_type === "manufactured"),
    [nomenclatureItems],
  );

  const isApproved = selectedPlan?.status === "approved";

  const loadPlanDetails = useCallback(async (planId) => {
    if (!planId) {
      setSelectedPlan(null);
      return;
    }
    setIsPlanLoading(true);
    setPlanError("");
    try {
      const plan = await getProductionPlan(planId);
      setSelectedPlan(plan);
    } catch (error) {
      setPlanError(toErrorMessage(error, "Не удалось загрузить план выпуска."));
      setSelectedPlan(null);
    } finally {
      setIsPlanLoading(false);
    }
  }, []);

  const loadPlans = useCallback(
    async (preferredPlanId = null) => {
      setIsPlansLoading(true);
      setPlansError("");
      try {
        const list = await getProductionPlans();
        setPlans(list);

        if (list.length === 0) {
          setSelectedPlanId("");
          setSelectedPlan(null);
          setPanelMode(PANEL_MODE_CONTEXT);
          return;
        }

        const preferredId = preferredPlanId ? Number(preferredPlanId) : null;
        const selectedId = selectedPlanId ? Number(selectedPlanId) : null;
        const hasPreferred = preferredId
          ? list.some((plan) => Number(plan.production_plan_id) === preferredId)
          : false;
        const hasSelected = selectedId
          ? list.some((plan) => Number(plan.production_plan_id) === selectedId)
          : false;
        const nextId = hasPreferred ? preferredId : hasSelected ? selectedId : Number(list[0].production_plan_id);
        setSelectedPlanId(String(nextId));
        await loadPlanDetails(nextId);
      } catch (error) {
        setPlansError(toErrorMessage(error, "Не удалось загрузить список планов выпуска."));
      } finally {
        setIsPlansLoading(false);
      }
    },
    [loadPlanDetails, selectedPlanId],
  );

  const loadNomenclature = useCallback(async () => {
    setIsNomenclatureLoading(true);
    try {
      const items = await getNomenclatureList();
      setNomenclatureItems(Array.isArray(items) ? items : []);
    } catch {
      setNomenclatureItems([]);
    } finally {
      setIsNomenclatureLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
    loadNomenclature();
  }, [loadPlans, loadNomenclature]);

  const handleSelectPlan = async (value) => {
    setSelectedPlanId(value);
    setPanelMode(PANEL_MODE_CONTEXT);
    setFormError("");
    setStatusSuccess("");
    if (!value) {
      setSelectedPlan(null);
      return;
    }
    await loadPlanDetails(Number(value));
  };

  const openCreatePlanForm = () => {
    setPanelMode(PANEL_MODE_CREATE_PLAN);
    setFormError("");
    setStatusSuccess("");
    setCreateMonth(getCurrentMonthValue());
    setCreatePlanName("");
    setCreateComment("");
  };

  const openEditPlanForm = () => {
    if (!selectedPlan || isApproved) {
      return;
    }
    setPanelMode(PANEL_MODE_EDIT_PLAN);
    setFormError("");
    setStatusSuccess("");
    setEditPlanName(selectedPlan.plan_name || "");
    setEditPlanComment(selectedPlan.comment || "");
  };

  const openCreateLineForm = () => {
    if (!selectedPlan || isApproved) {
      return;
    }
    setPanelMode(PANEL_MODE_CREATE_LINE);
    setFormError("");
    setStatusSuccess("");
    setLineEditItem(null);
    setLineNomenclatureId("");
    setLineQty("");
    setLinePriority(false);
    setLinePriorityNote("");
    setLineComment("");
  };

  const openEditLineForm = (line) => {
    if (isApproved) {
      return;
    }
    setPanelMode(PANEL_MODE_EDIT_LINE);
    setFormError("");
    setStatusSuccess("");
    setLineEditItem(line);
    setLineQty(String(line.planned_qty ?? ""));
    setLinePriority(Boolean(line.is_priority));
    setLinePriorityNote(line.priority_note || "");
    setLineComment(line.line_comment || "");
  };

  const handleCreatePlan = async (event) => {
    event.preventDefault();
    if (!createMonth) {
      setFormError("Выберите месяц планирования.");
      return;
    }
    const planDate = monthToApiDate(createMonth);
    if (!planDate) {
      setFormError("Некорректный формат месяца.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      const created = await createProductionPlan({
        plan_month: planDate,
        plan_name: createPlanName.trim() || null,
        comment: createComment.trim() || null,
      });
      await loadPlans(created.production_plan_id);
      setPanelMode(PANEL_MODE_CONTEXT);
    } catch (error) {
      setFormError(toErrorMessage(error, "Не удалось создать план выпуска."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePlan = async (event) => {
    event.preventDefault();
    if (!selectedPlan || isApproved) {
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      await updateProductionPlan(selectedPlan.production_plan_id, {
        plan_name: editPlanName.trim() || selectedPlan.plan_name,
        comment: editPlanComment.trim() || null,
      });
      await loadPlans(selectedPlan.production_plan_id);
      setPanelMode(PANEL_MODE_CONTEXT);
    } catch (error) {
      setFormError(toErrorMessage(error, "Не удалось обновить план выпуска."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateLine = async (event) => {
    event.preventDefault();
    if (!selectedPlan || isApproved) {
      return;
    }
    const qty = Number(lineQty);
    if (!lineNomenclatureId) {
      setFormError("Выберите номенклатуру.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError("План выпуска должен быть больше нуля.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      await addProductionPlanLine(selectedPlan.production_plan_id, {
        nomenclature_id: Number(lineNomenclatureId),
        planned_qty: qty,
        is_priority: linePriority,
        priority_note: linePriority ? linePriorityNote.trim() || null : null,
        line_comment: lineComment.trim() || null,
      });
      await loadPlanDetails(selectedPlan.production_plan_id);
      setPanelMode(PANEL_MODE_CONTEXT);
    } catch (error) {
      setFormError(toErrorMessage(error, "Не удалось добавить строку плана."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateLine = async (event) => {
    event.preventDefault();
    if (!lineEditItem || !selectedPlan || isApproved) {
      return;
    }
    const qty = Number(lineQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError("План выпуска должен быть больше нуля.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      await updateProductionPlanLine(lineEditItem.production_plan_line_id, {
        planned_qty: qty,
        is_priority: linePriority,
        priority_note: linePriority ? linePriorityNote.trim() || null : null,
        line_comment: lineComment.trim() || null,
      });
      await loadPlanDetails(selectedPlan.production_plan_id);
      setPanelMode(PANEL_MODE_CONTEXT);
    } catch (error) {
      setFormError(toErrorMessage(error, "Не удалось обновить строку плана."));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeletePlan = async () => {
    if (!planDeleteCandidate) {
      return;
    }
    setDeletingPlan(true);
    try {
      await deleteProductionPlan(planDeleteCandidate.production_plan_id);
      setPlanDeleteCandidate(null);
      await loadPlans();
    } catch (error) {
      setFormError(toErrorMessage(error, "Не удалось удалить план выпуска."));
    } finally {
      setDeletingPlan(false);
    }
  };

  const confirmDeleteLine = async () => {
    if (!lineDeleteCandidate || !selectedPlan) {
      return;
    }
    setDeletingLine(true);
    try {
      await deleteProductionPlanLine(lineDeleteCandidate.production_plan_line_id);
      setLineDeleteCandidate(null);
      await loadPlanDetails(selectedPlan.production_plan_id);
    } catch (error) {
      setFormError(toErrorMessage(error, "Не удалось удалить строку плана."));
    } finally {
      setDeletingLine(false);
    }
  };

  const handleApprovePlan = async () => {
    if (!approveCandidate) {
      return;
    }
    setIsStatusChanging(true);
    setFormError("");
    setStatusSuccess("");
    try {
      const plan = await approveProductionPlan(approveCandidate.production_plan_id);
      await loadPlans(plan.production_plan_id);
      setStatusSuccess("План выпуска утверждён.");
      setApproveCandidate(null);
      setPanelMode(PANEL_MODE_CONTEXT);
    } catch (error) {
      setFormError(toErrorMessage(error, "Не удалось утвердить план выпуска."));
    } finally {
      setIsStatusChanging(false);
    }
  };

  const handleReturnToDraft = async () => {
    if (!returnDraftCandidate) {
      return;
    }
    setIsStatusChanging(true);
    setFormError("");
    setStatusSuccess("");
    try {
      const plan = await returnProductionPlanToDraft(returnDraftCandidate.production_plan_id);
      await loadPlans(plan.production_plan_id);
      setStatusSuccess("План выпуска возвращён в черновик.");
      setReturnDraftCandidate(null);
      setPanelMode(PANEL_MODE_CONTEXT);
    } catch (error) {
      setFormError(toErrorMessage(error, "Не удалось вернуть план в черновик."));
    } finally {
      setIsStatusChanging(false);
    }
  };

  const selectedPlanLines = selectedPlan?.lines ?? [];
  const sortedPlanLines = useMemo(() => {
    return [...selectedPlanLines].sort((a, b) => {
      if (a.is_priority !== b.is_priority) {
        return a.is_priority ? -1 : 1;
      }
      return String(a.nomenclature_code || "").localeCompare(String(b.nomenclature_code || ""), "ru");
    });
  }, [selectedPlanLines]);
  const priorityCount = selectedPlanLines.filter((line) => line.is_priority).length;

  const renderRightPanel = () => {
    if (panelMode === PANEL_MODE_CREATE_PLAN) {
      return (
        <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
          <div className="text-xs tracking-[0.08em] text-slate-500">Создание</div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Создать план</h2>
          <form className="mt-5 space-y-4" onSubmit={handleCreatePlan}>
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Месяц планирования</div>
              <input
                type="month"
                value={createMonth}
                onChange={(event) => setCreateMonth(event.target.value)}
                className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              />
            </div>
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Название плана</div>
              <input
                type="text"
                value={createPlanName}
                onChange={(event) => setCreatePlanName(event.target.value)}
                className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                placeholder="Необязательно"
              />
            </div>
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Комментарий</div>
              <textarea
                value={createComment}
                onChange={(event) => setCreateComment(event.target.value)}
                rows={3}
                className="w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              />
            </div>
            {formError ? <div className="text-sm text-rose-200">{formError}</div> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="h-10 flex-1 rounded-none border border-cyan-300/35 bg-cyan-400/[0.15] px-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.22] disabled:opacity-60"
              >
                {isSaving ? "Сохраняем..." : "Создать"}
              </button>
              <button
                type="button"
                onClick={() => setPanelMode(PANEL_MODE_CONTEXT)}
                disabled={isSaving}
                className="h-10 rounded-none border border-white/15 px-3 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-60"
              >
                Отмена
              </button>
            </div>
          </form>
        </aside>
      );
    }

    if (panelMode === PANEL_MODE_EDIT_PLAN && selectedPlan) {
      return (
        <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
          <div className="text-xs tracking-[0.08em] text-slate-500">Редактирование</div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Параметры плана</h2>
          <form className="mt-5 space-y-4" onSubmit={handleUpdatePlan}>
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Название плана</div>
              <input
                type="text"
                value={editPlanName}
                onChange={(event) => setEditPlanName(event.target.value)}
                className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              />
            </div>
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Комментарий</div>
              <textarea
                value={editPlanComment}
                onChange={(event) => setEditPlanComment(event.target.value)}
                rows={3}
                className="w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              />
            </div>
            {formError ? <div className="text-sm text-rose-200">{formError}</div> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="h-10 flex-1 rounded-none border border-cyan-300/35 bg-cyan-400/[0.15] px-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.22] disabled:opacity-60"
              >
                {isSaving ? "Сохраняем..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => setPanelMode(PANEL_MODE_CONTEXT)}
                disabled={isSaving}
                className="h-10 rounded-none border border-white/15 px-3 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-60"
              >
                Отмена
              </button>
            </div>
          </form>
        </aside>
      );
    }

    if (panelMode === PANEL_MODE_CREATE_LINE && selectedPlan) {
      return (
        <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
          <div className="text-xs tracking-[0.08em] text-slate-500">Строка плана</div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Добавить позицию</h2>
          <form className="mt-5 space-y-4" onSubmit={handleCreateLine}>
            <NomenclatureSearchSelect
              label="Номенклатура"
              items={manufacturedNomenclature}
              value={lineNomenclatureId ? Number(lineNomenclatureId) : null}
              onChange={(value) => setLineNomenclatureId(String(value))}
              disabled={isNomenclatureLoading || isSaving}
            />
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">План выпуска</div>
              <input
                type="number"
                min="0"
                step="0.001"
                value={lineQty}
                onChange={(event) => setLineQty(event.target.value)}
                className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={linePriority}
                onChange={(event) => setLinePriority(event.target.checked)}
                className="h-4 w-4 rounded-none border-white/20 bg-transparent"
              />
              Приоритетная позиция
            </label>
            {linePriority ? (
              <div>
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Комментарий к приоритету</div>
                <input
                  type="text"
                  value={linePriorityNote}
                  onChange={(event) => setLinePriorityNote(event.target.value)}
                  className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </div>
            ) : null}
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Комментарий</div>
              <textarea
                rows={3}
                value={lineComment}
                onChange={(event) => setLineComment(event.target.value)}
                className="w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              />
            </div>
            {formError ? <div className="text-sm text-rose-200">{formError}</div> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="h-10 flex-1 rounded-none border border-cyan-300/35 bg-cyan-400/[0.15] px-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.22] disabled:opacity-60"
              >
                {isSaving ? "Сохраняем..." : "Добавить"}
              </button>
              <button
                type="button"
                onClick={() => setPanelMode(PANEL_MODE_CONTEXT)}
                disabled={isSaving}
                className="h-10 rounded-none border border-white/15 px-3 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-60"
              >
                Отмена
              </button>
            </div>
          </form>
        </aside>
      );
    }

    if (panelMode === PANEL_MODE_EDIT_LINE && lineEditItem) {
      return (
        <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
          <div className="text-xs tracking-[0.08em] text-slate-500">Строка плана</div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Редактировать позицию</h2>
          <div className="mt-4 space-y-1 text-sm text-slate-300">
            <div>Код: {lineEditItem.nomenclature_code}</div>
            <div>Номенклатура: {lineEditItem.nomenclature_name}</div>
            <div>Ед.: {lineEditItem.unit_of_measure}</div>
          </div>
          <form className="mt-5 space-y-4" onSubmit={handleUpdateLine}>
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">План выпуска</div>
              <input
                type="number"
                min="0"
                step="0.001"
                value={lineQty}
                onChange={(event) => setLineQty(event.target.value)}
                className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={linePriority}
                onChange={(event) => setLinePriority(event.target.checked)}
                className="h-4 w-4 rounded-none border-white/20 bg-transparent"
              />
              Приоритетная позиция
            </label>
            {linePriority ? (
              <div>
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Комментарий к приоритету</div>
                <input
                  type="text"
                  value={linePriorityNote}
                  onChange={(event) => setLinePriorityNote(event.target.value)}
                  className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                />
              </div>
            ) : null}
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Комментарий</div>
              <textarea
                rows={3}
                value={lineComment}
                onChange={(event) => setLineComment(event.target.value)}
                className="w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              />
            </div>
            {formError ? <div className="text-sm text-rose-200">{formError}</div> : null}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="h-10 flex-1 rounded-none border border-cyan-300/35 bg-cyan-400/[0.15] px-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.22] disabled:opacity-60"
              >
                {isSaving ? "Сохраняем..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => setPanelMode(PANEL_MODE_CONTEXT)}
                disabled={isSaving}
                className="h-10 rounded-none border border-white/15 px-3 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-60"
              >
                Отмена
              </button>
            </div>
          </form>
        </aside>
      );
    }

    return (
      <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
        <div className="text-xs tracking-[0.08em] text-slate-500">Контекст</div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">План выпуска</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Месячный план выпуска содержит только производимую номенклатуру.
        </p>

        {selectedPlan ? (
          <>
            <div className="panel-divider mt-5" />
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Период</span>
                <span className="font-medium text-slate-100">{formatPlanMonth(selectedPlan.plan_month)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Статус</span>
                <span className={["inline-flex items-center rounded-none border px-2 py-0.5 text-xs", getStatusBadgeClass(selectedPlan.status)].join(" ")}>
                  {getStatusLabel(selectedPlan.status)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Позиций</span>
                <span className="font-medium text-slate-100">{selectedPlanLines.length}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Приоритетных</span>
                <span className="font-medium text-slate-100">{priorityCount}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Создан</span>
                <span className="text-slate-200">{formatDateTime(selectedPlan.created_at)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Изменён</span>
                <span className="text-slate-200">{formatDateTime(selectedPlan.updated_at)}</span>
              </div>
            </div>

            {isApproved ? (
              <div className="mt-4 rounded-none border border-emerald-300/25 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-100">
                План утверждён и защищён от изменений.
              </div>
            ) : null}

            <div className="panel-divider mt-5" />
            <div className="mt-4 rounded-none border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="text-sm font-medium text-slate-200">Проверка данных</div>
              <div className="mt-2 flex items-start gap-2 text-sm text-slate-300">
                {selectedPlanLines.length > 0 ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 text-slate-400" />
                )}
                <span>
                  {isApproved
                    ? "План утверждён и защищён от изменений."
                    : selectedPlanLines.length > 0
                      ? "План содержит позиции выпуска."
                      : "План пока не содержит позиций."}
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-none border border-white/[0.08] bg-white/[0.02] p-3">
              <div className="text-sm font-medium text-slate-200">Подсказка</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">
                Закупаемая номенклатура не включается в план выпуска и остаётся во внешнем обеспечении.
              </div>
            </div>

          </>
        ) : (
          <div className="mt-5 text-sm text-slate-400">Выберите или создайте план выпуска.</div>
        )}
      </aside>
    );
  };

  return (
    <section className="space-y-6">
      <header className="glass-panel p-4 sm:p-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">Планирование выпуска</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Сформируйте месячный план выпуска по производимой номенклатуре и зафиксируйте его перед дальнейшим планированием.
        </p>
      </header>

      {statusSuccess ? (
        <div className="glass-panel border-emerald-300/30 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-100">
          {statusSuccess}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <section className="glass-panel p-5 sm:p-6">
            <div className="text-xs tracking-[0.08em] text-slate-500">План на месяц</div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[280px] flex-1">
                <select
                  value={selectedPlanId}
                  onChange={(event) => handleSelectPlan(event.target.value)}
                  disabled={isPlansLoading || plans.length === 0}
                  className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40 disabled:opacity-60"
                >
                  {plans.length === 0 ? (
                    <option value="">Планы выпуска ещё не созданы.</option>
                  ) : (
                    plans.map((plan) => (
                      <option key={plan.production_plan_id} value={plan.production_plan_id}>
                        {formatPlanMonth(plan.plan_month)} — {plan.plan_name} — {getStatusLabel(plan.status)}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button
                type="button"
                onClick={openCreatePlanForm}
                className="h-11 rounded-none border border-cyan-300/35 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.22]"
              >
                Создать план
              </button>
              <button
                type="button"
                onClick={() => loadPlans(selectedPlanId ? Number(selectedPlanId) : null)}
                disabled={isPlansLoading || isPlanLoading}
                className="inline-flex h-11 items-center gap-2 rounded-none border border-white/12 px-4 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-60"
              >
                <RefreshCw className={["h-4 w-4", isPlansLoading || isPlanLoading ? "animate-spin" : ""].join(" ")} />
                Обновить
              </button>
            </div>
            {plansError ? <div className="mt-3 text-sm text-rose-200">{plansError}</div> : null}
          </section>

          {selectedPlan ? (
            <section className="glass-panel p-5 sm:p-6">
              <div className="rounded-none border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-slate-50">{selectedPlan.plan_name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Период: {formatPlanMonth(selectedPlan.plan_month)} · Статус:{" "}
                      <span className={["inline-flex items-center rounded-none border px-2 py-0.5 text-xs", getStatusBadgeClass(selectedPlan.status)].join(" ")}>
                        {getStatusLabel(selectedPlan.status)}
                      </span>{" "}
                      · Позиций: {selectedPlanLines.length} · Приоритетных: {priorityCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isApproved ? (
                      <>
                        <button
                          type="button"
                          onClick={openEditPlanForm}
                          className="h-10 rounded-none border border-white/15 px-3 text-sm text-slate-200 transition hover:border-cyan-300/30"
                        >
                          Редактировать план
                        </button>
                        <button
                          type="button"
                          onClick={() => setApproveCandidate(selectedPlan)}
                          className="h-10 rounded-none border border-emerald-300/30 bg-emerald-400/[0.1] px-3 text-sm text-emerald-100 transition hover:bg-emerald-400/[0.16]"
                        >
                          Утвердить план
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlanDeleteCandidate(selectedPlan)}
                          className="h-10 rounded-none border border-rose-300/30 bg-rose-400/[0.08] px-3 text-sm text-rose-100 transition hover:bg-rose-400/[0.16]"
                        >
                          Удалить план
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReturnDraftCandidate(selectedPlan)}
                        className="h-10 rounded-none border border-cyan-300/30 bg-cyan-400/[0.12] px-3 text-sm text-cyan-50 transition hover:bg-cyan-400/[0.2]"
                      >
                        Вернуть в черновик
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {isApproved ? (
                <div className="mt-4 rounded-none border border-emerald-300/25 bg-emerald-500/[0.08] px-4 py-3 text-sm text-emerald-100">
                  План утверждён. Изменения заблокированы. Чтобы внести изменения, верните план в черновик.
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-slate-50">Позиции плана выпуска</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Позиций: {selectedPlanLines.length}</p>
                </div>
                <button
                  type="button"
                  onClick={openCreateLineForm}
                  disabled={isApproved}
                  title={isApproved ? "Утверждённый план нельзя изменять." : ""}
                  className="inline-flex h-10 items-center gap-2 rounded-none border border-cyan-300/35 bg-cyan-400/[0.12] px-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.22] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isApproved ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  Добавить позицию
                </button>
              </div>

              {formError ? <div className="mt-4 text-sm text-rose-200">{formError}</div> : null}
              {planError ? <div className="mt-4 text-sm text-rose-200">{planError}</div> : null}

              {isPlanLoading ? (
                <div className="mt-4 text-sm text-slate-400">Загружаем план...</div>
              ) : selectedPlanLines.length === 0 ? (
                <div className="mt-4 rounded-none border border-white/[0.08] bg-white/[0.02] px-4 py-5 text-sm text-slate-400">
                  <div>В плане пока нет позиций выпуска.</div>
                  <div className="mt-1 text-slate-500">
                    Добавьте производимую номенклатуру вручную или сформируйте план из расчёта потребности.
                  </div>
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10">
                  <div className="max-h-[520px] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-[11px] uppercase tracking-[0.08em] text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Код</th>
                          <th className="px-3 py-2 text-left font-medium">Номенклатура</th>
                          <th className="px-3 py-2 text-right font-medium">План выпуска</th>
                          <th className="px-3 py-2 text-left font-medium">Ед.</th>
                          <th className="px-3 py-2 text-left font-medium">Приоритет</th>
                          <th className="px-3 py-2 text-left font-medium">Комментарий</th>
                          <th className="px-3 py-2 text-right font-medium">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPlanLines.map((line) => (
                          <tr
                            key={line.production_plan_line_id}
                            className={[
                              "border-t border-white/[0.05] hover:bg-cyan-300/[0.03]",
                              line.is_priority ? "bg-amber-400/[0.03]" : "",
                            ].join(" ")}
                          >
                            <td className="px-3 py-2.5 font-medium text-slate-100">{line.nomenclature_code}</td>
                            <td className="px-3 py-2.5 text-slate-300">{line.nomenclature_name}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{line.planned_qty}</td>
                            <td className="px-3 py-2.5 text-slate-300">{line.unit_of_measure}</td>
                            <td className="px-3 py-2.5">
                              {line.is_priority ? (
                                <span className="inline-flex items-center rounded-none border border-amber-300/30 bg-amber-400/[0.08] px-2 py-0.5 text-xs text-amber-100">
                                  Приоритет
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-slate-400">{line.line_comment || "—"}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditLineForm(line)}
                                  disabled={isApproved}
                                  title={isApproved ? "Утверждённый план нельзя изменять." : ""}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-white/10 text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setLineDeleteCandidate(line)}
                                  disabled={isApproved}
                                  title={isApproved ? "Утверждённый план нельзя изменять." : ""}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-white/10 text-slate-300 transition hover:border-rose-300/35 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-45"
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
                  <div className="border-t border-cyan-300/10 px-3 py-2 text-sm text-slate-400">Позиций: {selectedPlanLines.length}</div>
                </div>
              )}
            </section>
          ) : (
            <section className="glass-panel px-4 py-5 text-sm text-slate-400">
              <div>Планы выпуска ещё не созданы.</div>
              <button
                type="button"
                onClick={openCreatePlanForm}
                className="mt-3 inline-flex h-10 items-center rounded-none border border-cyan-300/35 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.22]"
              >
                Создать план
              </button>
            </section>
          )}
        </div>

        {renderRightPanel()}
      </div>

      <V2ConfirmDialog
        open={Boolean(approveCandidate)}
        title="Утвердить план выпуска?"
        message="После утверждения план выпуска будет зафиксирован. Редактирование, удаление и обновление из расчёта будут недоступны, пока план не будет возвращён в черновик."
        confirmText={isStatusChanging ? "Утверждаем..." : "Утвердить"}
        cancelText="Отмена"
        onConfirm={handleApprovePlan}
        onCancel={() => setApproveCandidate(null)}
        isConfirmDisabled={isStatusChanging}
        isCancelDisabled={isStatusChanging}
      />

      <V2ConfirmDialog
        open={Boolean(returnDraftCandidate)}
        title="Вернуть план в черновик?"
        message="После возврата в черновик план снова можно будет редактировать, обновлять из расчёта и удалять. Перед дальнейшим планированием его нужно будет утвердить повторно."
        confirmText={isStatusChanging ? "Возвращаем..." : "Вернуть в черновик"}
        cancelText="Отмена"
        onConfirm={handleReturnToDraft}
        onCancel={() => setReturnDraftCandidate(null)}
        isConfirmDisabled={isStatusChanging}
        isCancelDisabled={isStatusChanging}
      />

      <V2ConfirmDialog
        open={Boolean(lineDeleteCandidate)}
        title="Удалить позицию из плана выпуска?"
        message={
          lineDeleteCandidate
            ? `Позиция ${lineDeleteCandidate.nomenclature_code} — ${lineDeleteCandidate.nomenclature_name} будет удалена из плана выпуска. Номенклатура в справочнике не удаляется.`
            : ""
        }
        confirmText={deletingLine ? "Удаляем..." : "Удалить"}
        cancelText="Отмена"
        onConfirm={confirmDeleteLine}
        onCancel={() => setLineDeleteCandidate(null)}
        isConfirmDisabled={deletingLine}
        isCancelDisabled={deletingLine}
      />

      <V2ConfirmDialog
        open={Boolean(planDeleteCandidate)}
        title="Удалить план выпуска?"
        message={planDeleteCandidate ? `План выпуска ${planDeleteCandidate.plan_name} и все его строки будут удалены.` : ""}
        confirmText={deletingPlan ? "Удаляем..." : "Удалить"}
        cancelText="Отмена"
        onConfirm={confirmDeletePlan}
        onCancel={() => setPlanDeleteCandidate(null)}
        isConfirmDisabled={deletingPlan}
        isCancelDisabled={deletingPlan}
      />
    </section>
  );
}

export default ProductionPlanningSection;



