import { Check, Save, X } from "lucide-react";
import { useEffect, useState } from "react";

const UNIT_OPTIONS = [
  { value: "м²", label: "м²" },
  { value: "м.п.", label: "м.п." },
  { value: "шт", label: "шт" },
  { value: "кг", label: "кг" },
  { value: "л", label: "л" },
];

const ITEM_TYPE_OPTIONS = [
  { value: "manufactured", label: "Производимая" },
  { value: "purchased", label: "Закупаемая" },
];

function createInitialState(item) {
  return {
    nomenclature_code: item?.nomenclature_code ?? "",
    nomenclature_name: item?.nomenclature_name ?? "",
    unit_of_measure: item?.unit_of_measure ?? "м²",
    item_type: item?.item_type ?? "manufactured",
    is_active: item?.is_active ?? true,
  };
}

function NomenclatureFormPanel({ mode, item, isSaving, errorMessage, onCancel, onSave }) {
  const isEditMode = mode === "edit";
  const [formValues, setFormValues] = useState(() => createInitialState(item));
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setFormValues(createInitialState(item));
    setLocalError("");
  }, [item, mode]);

  const handleFieldChange = (fieldName, fieldValue) => {
    setFormValues((previousValues) => ({
      ...previousValues,
      [fieldName]: fieldValue,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const normalizedCode = formValues.nomenclature_code.trim();
    const normalizedName = formValues.nomenclature_name.trim();

    if (!normalizedCode || !normalizedName) {
      setLocalError("Заполните код и наименование.");
      return;
    }

    setLocalError("");
    onSave({
      ...formValues,
      nomenclature_code: normalizedCode,
      nomenclature_name: normalizedName,
    });
  };

  return (
    <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="panel-title">{isEditMode ? "Редактирование позиции" : "Новая позиция"}</div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            {isEditMode ? "Изменение номенклатуры" : "Создание номенклатуры"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Заполните карточку позиции. После сохранения изменения сразу отобразятся в списке.
          </p>
        </div>
      </div>

      <div className="panel-divider mt-5" />

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Код номенклатуры</div>
          <input
            type="text"
            value={formValues.nomenclature_code}
            onChange={(event) => handleFieldChange("nomenclature_code", event.target.value)}
            placeholder="Например NM-012"
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Наименование</div>
          <input
            type="text"
            value={formValues.nomenclature_name}
            onChange={(event) => handleFieldChange("nomenclature_name", event.target.value)}
            placeholder="Введите наименование"
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-4 text-lg leading-7 text-slate-100 outline-none transition focus:border-cyan-200/40"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Тип номенклатуры</div>
          <select
            value={formValues.item_type}
            onChange={(event) => handleFieldChange("item_type", event.target.value)}
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          >
            {ITEM_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-950 text-slate-100">
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Единица измерения</div>
          <select
            value={formValues.unit_of_measure}
            onChange={(event) => handleFieldChange("unit_of_measure", event.target.value)}
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          >
            {UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-slate-950 text-slate-100">
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-3 border border-cyan-200/14 bg-cyan-400/[0.04] px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-100">Активность</div>
            <div className="mt-1 text-xs text-slate-500">
              Неактивные позиции сохраняются, но исключаются из оперативной работы.
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleFieldChange("is_active", !formValues.is_active)}
            className={[
              "inline-flex min-w-24 items-center justify-center gap-2 border px-3 py-2 text-xs uppercase tracking-[0.16em] transition",
              formValues.is_active
                ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-50"
                : "border-white/20 bg-white/[0.05] text-slate-300",
            ].join(" ")}
          >
            {formValues.is_active ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Активна
              </>
            ) : (
              "Неактивна"
            )}
          </button>
        </label>

        {localError ? <div className="border border-amber-300/30 bg-amber-500/[0.09] px-4 py-3 text-sm text-amber-100">{localError}</div> : null}
        {errorMessage ? <div className="border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">{errorMessage}</div> : null}

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

export default NomenclatureFormPanel;
