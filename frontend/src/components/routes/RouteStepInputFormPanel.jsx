import { Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import NomenclatureSearchSelect from "../shared/NomenclatureSearchSelect";

function createInitialState(item) {
  return {
    input_nomenclature_id: item?.input_nomenclature_id ?? "",
    input_qty: item?.input_qty ?? "1.000",
  };
}

function RouteStepInputFormPanel({ mode, item, nomenclatureItems, isSaving, errorMessage, onCancel, onSave }) {
  const isEditMode = mode === "edit";
  const [formValues, setFormValues] = useState(() => createInitialState(item));
  const [localError, setLocalError] = useState("");

  const sortedNomenclatureItems = useMemo(
    () => [...nomenclatureItems].sort((left, right) => left.nomenclature_code.localeCompare(right.nomenclature_code, "ru")),
    [nomenclatureItems],
  );

  useEffect(() => {
    setFormValues(createInitialState(item));
    setLocalError("");
  }, [item, mode]);

  const handleFieldChange = (fieldName, fieldValue) => {
    setFormValues((previousValues) => ({ ...previousValues, [fieldName]: fieldValue }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const normalizedQty = Number(formValues.input_qty);
    if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
      setLocalError("Количество входа должно быть больше 0.");
      return;
    }

    const normalizedNomenclatureId = Number(formValues.input_nomenclature_id);
    if (!Number.isInteger(normalizedNomenclatureId) || normalizedNomenclatureId <= 0) {
      setLocalError("Вход шага должен быть выбран из номенклатуры.");
      return;
    }

    setLocalError("");
    onSave({
      input_nomenclature_id: normalizedNomenclatureId,
      input_qty: Number(normalizedQty.toFixed(3)),
    });
  };

  return (
    <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="panel-title">{isEditMode ? "Редактирование входа" : "Новый вход шага"}</div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">{isEditMode ? "Изменение входа" : "Создание входа"}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Выберите номенклатуру для входа шага. Если компонента нет в списке, сначала добавьте его в справочник номенклатуры как закупаемую позицию.
          </p>
        </div>
      </div>

      <div className="panel-divider mt-5" />

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <NomenclatureSearchSelect
          label="Номенклатура"
          items={sortedNomenclatureItems}
          value={formValues.input_nomenclature_id}
          onChange={(nomenclatureId) => handleFieldChange("input_nomenclature_id", nomenclatureId)}
          placeholder="Начните вводить код или название"
          disabled={sortedNomenclatureItems.length === 0}
        />

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Количество</div>
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={formValues.input_qty}
            onChange={(event) => handleFieldChange("input_qty", event.target.value)}
            placeholder="Например 1.000"
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          />
        </label>

        {localError ? <div className="border border-amber-300/30 bg-amber-500/[0.09] px-4 py-3 text-sm text-amber-100">{localError}</div> : null}
        {errorMessage ? <div className="border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">{errorMessage}</div> : null}

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} disabled={isSaving} className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60">
            <X className="h-4 w-4" />Отмена
          </button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18 disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" />{isSaving ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </form>
    </aside>
  );
}

export default RouteStepInputFormPanel;
