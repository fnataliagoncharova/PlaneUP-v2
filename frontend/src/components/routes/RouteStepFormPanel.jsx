import { Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import NomenclatureSearchSelect from "../shared/NomenclatureSearchSelect";

function createInitialState(item, processItems) {
  const fallbackProcessId = processItems[0]?.process_id ?? "";

  return {
    step_no: item?.step_no ?? "",
    process_id: item?.process_id ?? fallbackProcessId,
    output_nomenclature_id: item?.output_nomenclature_id ?? "",
    output_qty: item?.output_qty ?? "1.000",
    notes: item?.notes ?? "",
  };
}

function RouteStepFormPanel({
  mode,
  item,
  processItems,
  nomenclatureItems,
  routeSteps,
  isSaving,
  errorMessage,
  onCancel,
  onSave,
}) {
  const isEditMode = mode === "edit";
  const [formValues, setFormValues] = useState(() =>
    createInitialState(item, processItems),
  );
  const [localError, setLocalError] = useState("");
  const [pendingPayload, setPendingPayload] = useState(null);
  const [isDuplicateProcessWarningOpen, setIsDuplicateProcessWarningOpen] = useState(false);

  const sortedProcessItems = useMemo(
    () =>
      [...processItems].sort((left, right) =>
        left.process_code.localeCompare(right.process_code, "ru"),
      ),
    [processItems],
  );

  const sortedNomenclatureItems = useMemo(
    () =>
      [...nomenclatureItems].sort((left, right) =>
        left.nomenclature_code.localeCompare(right.nomenclature_code, "ru"),
      ),
    [nomenclatureItems],
  );

  useEffect(() => {
    setFormValues(createInitialState(item, sortedProcessItems));
    setLocalError("");
    setPendingPayload(null);
    setIsDuplicateProcessWarningOpen(false);
  }, [item, mode, sortedProcessItems]);

  const hasDuplicateProcessInRoute = (processId) =>
    routeSteps.some(
      (step) => step.process_id === processId && step.route_step_id !== item?.route_step_id,
    );

  const handleFieldChange = (fieldName, fieldValue) => {
    if (isDuplicateProcessWarningOpen) {
      setIsDuplicateProcessWarningOpen(false);
      setPendingPayload(null);
    }

    setFormValues((previousValues) => ({
      ...previousValues,
      [fieldName]: fieldValue,
    }));
  };

  const handleConfirmDuplicateProcess = () => {
    if (!pendingPayload) {
      return;
    }

    setIsDuplicateProcessWarningOpen(false);
    onSave(pendingPayload);
  };

  const handleCancelDuplicateProcess = () => {
    setIsDuplicateProcessWarningOpen(false);
    setPendingPayload(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const normalizedStepNo = Number(formValues.step_no);
    const normalizedProcessId = Number(formValues.process_id);
    const normalizedOutputNomenclatureId = Number(formValues.output_nomenclature_id);
    const normalizedOutputQty = Number(formValues.output_qty);

    if (!Number.isInteger(normalizedStepNo) || normalizedStepNo <= 0) {
      setLocalError("Номер шага должен быть целым числом больше 0.");
      return;
    }

    if (!Number.isInteger(normalizedProcessId) || normalizedProcessId <= 0) {
      setLocalError("Выберите технологическую операцию.");
      return;
    }

    if (
      !Number.isInteger(normalizedOutputNomenclatureId) ||
      normalizedOutputNomenclatureId <= 0
    ) {
      setLocalError("Выберите выходную номенклатуру.");
      return;
    }

    if (!Number.isFinite(normalizedOutputQty) || normalizedOutputQty <= 0) {
      setLocalError("Количество результата должно быть больше 0.");
      return;
    }

    setLocalError("");
    const payload = {
      step_no: normalizedStepNo,
      process_id: normalizedProcessId,
      output_nomenclature_id: normalizedOutputNomenclatureId,
      output_qty: Number(normalizedOutputQty.toFixed(3)),
      notes: formValues.notes.trim() || null,
    };

    if (hasDuplicateProcessInRoute(payload.process_id)) {
      setPendingPayload(payload);
      setIsDuplicateProcessWarningOpen(true);
      return;
    }

    setPendingPayload(null);
    onSave(payload);
  };

  return (
    <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="panel-title">
            {isEditMode ? "Редактирование шага" : "Новый шаг маршрута"}
          </div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            {isEditMode ? "Изменение шага" : "Создание шага"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Заполните параметры шага маршрута. Входы и оборудование шага будут подключены на
            следующем этапе.
          </p>
        </div>
      </div>

      <div className="panel-divider mt-5" />

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Номер шага</div>
          <input
            type="number"
            min="1"
            step="1"
            value={formValues.step_no}
            onChange={(event) => handleFieldChange("step_no", event.target.value)}
            placeholder="Например 3"
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
            Технологическая операция
          </div>
          <select
            value={formValues.process_id}
            onChange={(event) => handleFieldChange("process_id", event.target.value)}
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          >
            {sortedProcessItems.map((processItem) => (
              <option
                key={processItem.process_id}
                value={processItem.process_id}
                className="bg-slate-950 text-slate-100"
              >
                {processItem.process_code} — {processItem.process_name}
              </option>
            ))}
          </select>
        </label>

        <NomenclatureSearchSelect
          label="Выходная номенклатура"
          items={sortedNomenclatureItems}
          value={formValues.output_nomenclature_id}
          onChange={(nomenclatureId) =>
            handleFieldChange("output_nomenclature_id", nomenclatureId)
          }
          placeholder="Начните вводить код или название"
          disabled={sortedNomenclatureItems.length === 0}
        />

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
            Количество результата
          </div>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={formValues.output_qty}
            onChange={(event) => handleFieldChange("output_qty", event.target.value)}
            placeholder="Например 1.000"
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Примечание</div>
          <textarea
            rows={4}
            value={formValues.notes}
            onChange={(event) => handleFieldChange("notes", event.target.value)}
            placeholder="Краткое описание шага"
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-base leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          />
        </label>

        {localError ? (
          <div className="border border-amber-300/30 bg-amber-500/[0.09] px-4 py-3 text-sm text-amber-100">
            {localError}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        {isDuplicateProcessWarningOpen ? (
          <div className="border border-amber-300/30 bg-amber-500/[0.09] px-4 py-3">
            <div className="text-sm text-amber-100">
              Операция уже используется в этом маршруте.
              <br />
              Продолжить?
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelDuplicateProcess}
                disabled={isSaving}
                className="inline-flex items-center rounded-none border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmDuplicateProcess}
                disabled={isSaving}
                className="inline-flex items-center rounded-none border border-amber-300/35 bg-amber-300/16 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-amber-50 transition hover:bg-amber-300/22 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Продолжить
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            Отмена
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </form>
    </aside>
  );
}

export default RouteStepFormPanel;
