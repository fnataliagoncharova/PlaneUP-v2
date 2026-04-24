import { Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const RATE_UOM_OPTIONS = ["м²/мин", "м.п./мин"];

function createInitialState(item, machines) {
  const fallbackMachineId = machines[0]?.machine_id ?? "";

  return {
    machine_id: item?.machine_id ?? fallbackMachineId,
    equipment_role: item?.equipment_role ?? "primary",
    priority: item?.priority ?? 1,
    nominal_rate: item?.nominal_rate ?? "1.000",
    rate_uom: item?.rate_uom ?? RATE_UOM_OPTIONS[0],
    is_active: item?.is_active ?? true,
  };
}

function RouteStepEquipmentFormPanel({
  mode,
  item,
  machineItems,
  isSaving,
  errorMessage,
  onCancel,
  onSave,
}) {
  const isEditMode = mode === "edit";
  const [formValues, setFormValues] = useState(() => createInitialState(item, machineItems));
  const [localError, setLocalError] = useState("");

  const sortedMachineItems = useMemo(
    () =>
      [...machineItems].sort((left, right) =>
        left.machine_code.localeCompare(right.machine_code, "ru"),
      ),
    [machineItems],
  );

  useEffect(() => {
    setFormValues(createInitialState(item, sortedMachineItems));
    setLocalError("");
  }, [item, mode, sortedMachineItems]);

  const handleFieldChange = (fieldName, fieldValue) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      [fieldName]: fieldValue,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const normalizedMachineId = Number(formValues.machine_id);
    const normalizedPriority = Number(formValues.priority);
    const normalizedRate = Number(formValues.nominal_rate);

    if (!Number.isInteger(normalizedMachineId) || normalizedMachineId <= 0) {
      setLocalError("Выберите оборудование.");
      return;
    }

    if (!["primary", "alternative"].includes(formValues.equipment_role)) {
      setLocalError("Выберите роль оборудования.");
      return;
    }

    if (!Number.isInteger(normalizedPriority) || normalizedPriority <= 0) {
      setLocalError("Приоритет должен быть целым числом больше 0.");
      return;
    }

    if (!Number.isFinite(normalizedRate) || normalizedRate <= 0) {
      setLocalError("Производительность должна быть больше 0.");
      return;
    }

    if (!RATE_UOM_OPTIONS.includes(formValues.rate_uom)) {
      setLocalError("Выберите единицу производительности.");
      return;
    }

    setLocalError("");
    onSave({
      machine_id: normalizedMachineId,
      equipment_role: formValues.equipment_role,
      priority: normalizedPriority,
      nominal_rate: Number(normalizedRate.toFixed(3)),
      rate_uom: formValues.rate_uom,
      is_active: Boolean(formValues.is_active),
    });
  };

  return (
    <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="panel-title">
            {isEditMode ? "Редактирование оборудования" : "Новое оборудование шага"}
          </div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            {isEditMode ? "Изменение оборудования" : "Добавление оборудования"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Укажите оборудование для шага, его роль и производительность.
          </p>
        </div>
      </div>

      <div className="panel-divider mt-5" />

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Оборудование</div>
          <select
            value={formValues.machine_id}
            onChange={(event) => handleFieldChange("machine_id", event.target.value)}
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          >
            {sortedMachineItems.length === 0 ? (
              <option value="" className="bg-slate-950 text-slate-400">
                Нет доступного оборудования
              </option>
            ) : null}
            {sortedMachineItems.map((machineItem) => (
              <option
                key={machineItem.machine_id}
                value={machineItem.machine_id}
                className="bg-slate-950 text-slate-100"
              >
                {machineItem.machine_code} - {machineItem.machine_name}
              </option>
            ))}
          </select>
        </label>

        <div className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Роль</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleFieldChange("equipment_role", "primary")}
              className={[
                "rounded-none border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition",
                formValues.equipment_role === "primary"
                  ? "border-cyan-300/35 bg-cyan-300/16 text-cyan-50"
                  : "border-white/12 bg-white/[0.04] text-slate-300 hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]",
              ].join(" ")}
            >
              Основное
            </button>
            <button
              type="button"
              onClick={() => handleFieldChange("equipment_role", "alternative")}
              className={[
                "rounded-none border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition",
                formValues.equipment_role === "alternative"
                  ? "border-slate-300/35 bg-slate-300/16 text-slate-100"
                  : "border-white/12 bg-white/[0.04] text-slate-300 hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]",
              ].join(" ")}
            >
              Альтернативное
            </button>
          </div>
        </div>

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Приоритет</div>
          <input
            type="number"
            min="1"
            step="1"
            value={formValues.priority}
            onChange={(event) => handleFieldChange("priority", event.target.value)}
            placeholder="Например 1"
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Производительность</div>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={formValues.nominal_rate}
            onChange={(event) => handleFieldChange("nominal_rate", event.target.value)}
            placeholder="Например 12.000"
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Единица производительности</div>
          <select
            value={formValues.rate_uom}
            onChange={(event) => handleFieldChange("rate_uom", event.target.value)}
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          >
            {RATE_UOM_OPTIONS.map((rateUom) => (
              <option key={rateUom} value={rateUom} className="bg-slate-950 text-slate-100">
                {rateUom}
              </option>
            ))}
          </select>
        </label>

        <div className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Активность</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleFieldChange("is_active", true)}
              className={[
                "rounded-none border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition",
                formValues.is_active
                  ? "border-emerald-300/35 bg-emerald-300/18 text-emerald-50"
                  : "border-white/12 bg-white/[0.04] text-slate-300 hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]",
              ].join(" ")}
            >
              Активно
            </button>
            <button
              type="button"
              onClick={() => handleFieldChange("is_active", false)}
              className={[
                "rounded-none border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition",
                !formValues.is_active
                  ? "border-slate-300/30 bg-slate-500/[0.16] text-slate-200"
                  : "border-white/12 bg-white/[0.04] text-slate-300 hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]",
              ].join(" ")}
            >
              Неактивно
            </button>
          </div>
        </div>

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

export default RouteStepEquipmentFormPanel;