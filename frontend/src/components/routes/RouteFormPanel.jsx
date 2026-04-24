import { Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import NomenclatureSearchSelect from "../shared/NomenclatureSearchSelect";

function createInitialState(item) {
  return {
    route_code: item?.route_code ?? "",
    route_name: item?.route_name ?? "",
    result_nomenclature_id: item?.result_nomenclature_id ?? "",
  };
}

function RouteFormPanel({
  mode,
  item,
  nomenclatureItems,
  isSaving,
  errorMessage,
  onCancel,
  onSave,
}) {
  const isEditMode = mode === "edit";
  const [formValues, setFormValues] = useState(() =>
    createInitialState(item),
  );
  const [localError, setLocalError] = useState("");

  const sortedNomenclatureItems = useMemo(
    () =>
      [...nomenclatureItems].sort((left, right) =>
        left.nomenclature_code.localeCompare(right.nomenclature_code, "ru"),
      ),
    [nomenclatureItems],
  );

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

    const normalizedCode = formValues.route_code.trim();
    const normalizedName = formValues.route_name.trim();
    const normalizedResultNomenclatureId = Number(formValues.result_nomenclature_id);

    if (!normalizedCode || !normalizedName) {
      setLocalError("Заполните код и наименование маршрута.");
      return;
    }

    if (!Number.isInteger(normalizedResultNomenclatureId) || normalizedResultNomenclatureId <= 0) {
      setLocalError("Выберите выходную номенклатуру.");
      return;
    }

    setLocalError("");
    onSave({
      ...formValues,
      route_code: normalizedCode,
      route_name: normalizedName,
      result_nomenclature_id: normalizedResultNomenclatureId,
    });
  };

  return (
    <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="panel-title">
            {isEditMode ? "Редактирование маршрута" : "Новый маршрут"}
          </div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            {isEditMode ? "Изменение маршрута" : "Создание маршрута"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Заполните шапку маршрута. Детализация шагов будет доступна на следующем этапе.
          </p>
        </div>
      </div>

      <div className="panel-divider mt-5" />

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
            Код маршрута
          </div>
          <input
            type="text"
            value={formValues.route_code}
            onChange={(event) => handleFieldChange("route_code", event.target.value)}
            placeholder="Например RT-004"
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 text-lg leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
            Наименование маршрута
          </div>
          <input
            type="text"
            value={formValues.route_name}
            onChange={(event) => handleFieldChange("route_name", event.target.value)}
            placeholder="Введите наименование маршрута"
            className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-4 text-lg leading-7 text-slate-100 outline-none transition focus:border-cyan-200/40"
          />
        </label>

        <NomenclatureSearchSelect
          label="Выходная номенклатура"
          items={sortedNomenclatureItems}
          value={formValues.result_nomenclature_id}
          onChange={(nomenclatureId) =>
            handleFieldChange("result_nomenclature_id", nomenclatureId)
          }
          placeholder="Начните вводить код или название"
          disabled={sortedNomenclatureItems.length === 0}
        />

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

export default RouteFormPanel;
