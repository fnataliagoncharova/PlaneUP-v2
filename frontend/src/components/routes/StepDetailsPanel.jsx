import {
  ArrowRightLeft,
  Boxes,
  Cog,
  PackageCheck,
  PencilLine,
  Power,
  Plus,
  Trash2,
} from "lucide-react";

function formatQty(value) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    return "-";
  }

  return normalizedValue.toFixed(3);
}

function buildInputTitle(input) {
  if (!input.input_nomenclature_id) {
    return input.external_input_name || "Внешний вход";
  }

  const code = input.input_nomenclature_code || "NM";
  const name = input.input_nomenclature_name || "Номенклатура";

  return `${code} - ${name}`;
}

function buildEquipmentTitle(equipmentItem) {
  const code = equipmentItem.machine_code || "MC";
  const name = equipmentItem.machine_name || "Оборудование";

  return `${code} - ${name}`;
}

function getEquipmentRoleLabel(role) {
  return role === "primary" ? "Основное" : "Альтернативное";
}

function IconActionButton({ label, onClick, disabled = false, tone = "edit", children }) {
  const toneClassName =
    tone === "danger"
      ? "border-rose-300/30 bg-rose-500/[0.1] text-rose-100 hover:border-rose-300/42 hover:bg-rose-500/[0.18]"
      : "border-cyan-300/24 bg-cyan-400/[0.07] text-cyan-100/90 hover:border-cyan-300/38 hover:bg-cyan-400/[0.14]";

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={[
          "inline-flex h-8 w-8 items-center justify-center rounded-none border transition disabled:cursor-not-allowed disabled:opacity-55",
          toneClassName,
        ].join(" ")}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap border border-slate-200/14 bg-[rgba(6,12,20,0.96)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-slate-100 opacity-0 shadow-[0_6px_24px_rgba(2,8,20,0.55)] transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        {label}
      </span>
    </div>
  );
}

function StepDetailsPanel({
  selectedRoute,
  selectedResultNomenclatureLabel,
  step,
  processLabel,
  outputNomenclatureLabel,
  outputNomenclatureUom,
  onEditRoute,
  onActivateRoute,
  onDeactivateRoute,
  isChangingRouteStatus,
  routeStatusError,
  routeStatusNotice,
  onOpenCreateStep,
  onEditStep,
  onDeleteStep,
  isDeletingStep,
  inputs,
  isInputsLoading,
  inputsError,
  onOpenCreateInput,
  onEditInput,
  onDeleteInput,
  isDeletingInput,
  equipment,
  isEquipmentLoading,
  equipmentError,
  onOpenCreateEquipment,
  onEditEquipment,
  onDeleteEquipment,
  isDeletingEquipment,
}) {
  if (!selectedRoute) {
    return (
      <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
        <div className="flex min-h-[420px] items-center justify-center text-center">
          <div className="max-w-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center text-cyan-100">
              <Boxes className="h-8 w-8" />
            </div>
            <h2 className="mt-6 font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">
              Маршрут не выбран
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Выберите маршрут в списке слева, чтобы посмотреть карточку маршрута и детали шага.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="panel-title">Выбранный маршрут</div>
          <div className="mt-2 text-sm font-normal tracking-[0.12em] text-slate-200">
            {selectedRoute.route_code}
          </div>
          <h2 className="mt-2 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            {selectedRoute.route_name}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Выходная номенклатура: {selectedResultNomenclatureLabel}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={onEditRoute}
            className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]"
          >
            <PencilLine className="h-3.5 w-3.5" />
            Редактировать маршрут
          </button>
          <button
            type="button"
            onClick={selectedRoute.is_active ? onDeactivateRoute : onActivateRoute}
            disabled={isChangingRouteStatus}
            className={[
              "inline-flex items-center gap-2 rounded-none border px-3.5 py-2 text-xs font-medium uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-60",
              selectedRoute.is_active
                ? "border-rose-300/30 bg-rose-500/[0.09] text-rose-100 hover:bg-rose-500/[0.14]"
                : "border-emerald-300/30 bg-emerald-500/[0.11] text-emerald-100 hover:bg-emerald-500/[0.16]",
            ].join(" ")}
          >
            <Power className="h-3.5 w-3.5" />
            {selectedRoute.is_active ? "Деактивировать" : "Активировать"}
          </button>
        </div>
      </div>

      <div className="panel-divider mt-5" />

      {routeStatusError ? (
        <div className="mt-4 rounded-none border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
          {routeStatusError}
        </div>
      ) : null}

      {routeStatusNotice ? (
        <div className="mt-4 rounded-none border border-amber-300/30 bg-amber-500/[0.12] px-4 py-3 text-sm text-amber-50">
          {routeStatusNotice}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="panel-title">Шаг маршрута</div>
        <button
          type="button"
          onClick={onOpenCreateStep}
          className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить шаг
        </button>
      </div>

      {step ? (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">
              Шаг {step.step_no}
            </h3>
            <div className="flex items-center gap-2">
              <IconActionButton label="Редактировать" onClick={onEditStep}>
                <PencilLine className="h-3.5 w-3.5" />
              </IconActionButton>
              <IconActionButton
                label="Удалить"
                onClick={onDeleteStep}
                disabled={isDeletingStep}
                tone="danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconActionButton>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-none border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,24,35,0.42),rgba(10,18,27,0.52))] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Технологическая операция</div>
              <div className="mt-2 text-sm font-medium text-slate-100">{processLabel}</div>
            </div>

            <div className="rounded-none border border-cyan-100/56 bg-[linear-gradient(180deg,rgba(32,174,207,0.4),rgba(16,78,107,0.86))] px-5 py-5 shadow-[0_0_0_1px_rgba(125,246,255,0.22),inset_0_1px_0_rgba(255,255,255,0.08),0_0_48px_rgba(34,211,238,0.34)]">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-100/65">
                <PackageCheck className="h-3.5 w-3.5" />
                Выход
              </div>
              <div className="text-[1.22rem] font-semibold leading-tight text-cyan-50">
                {outputNomenclatureLabel}
              </div>
              <div className="mt-3 text-sm font-medium text-cyan-100/85">
                {formatQty(step.output_qty)} {outputNomenclatureUom || "ед."}
              </div>
            </div>

            <div className="rounded-none border border-white/[0.06] bg-[linear-gradient(180deg,rgba(15,24,35,0.42),rgba(10,18,27,0.52))] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Примечание</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {step.notes || "Примечание не заполнено."}
              </p>
            </div>
          </div>

          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
                  <ArrowRightLeft className="h-4 w-4" />
                </div>
                <div className="text-lg font-medium text-slate-50">Входы шага</div>
              </div>
              <button
                type="button"
                onClick={onOpenCreateInput}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-cyan-50 transition hover:bg-cyan-400/18"
              >
                <Plus className="h-3.5 w-3.5" />
                Добавить вход
              </button>
            </div>

            {isInputsLoading ? (
              <div className="rounded-none border border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,26,37,0.58),rgba(10,18,27,0.7))] px-4 py-4 text-sm text-slate-400">
                Загрузка входов шага...
              </div>
            ) : inputsError ? (
              <div className="rounded-none border border-rose-300/30 bg-rose-500/[0.1] px-4 py-4 text-sm text-rose-100">
                {inputsError}
              </div>
            ) : inputs.length === 0 ? (
              <div className="rounded-none border border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,26,37,0.58),rgba(10,18,27,0.7))] px-4 py-4 text-sm text-slate-400">
                Для этого шага пока нет входов. Добавьте первый вход.
              </div>
            ) : (
              <div className="space-y-3">
                {inputs.map((input) => {
                  const isExternal = !input.input_nomenclature_id;

                  return (
                    <div
                      key={input.step_input_id}
                      className={[
                        "rounded-none border px-4 py-4",
                        isExternal
                          ? "border-amber-200/28 bg-[linear-gradient(180deg,rgba(112,73,27,0.28),rgba(48,31,17,0.66))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                          : "border-cyan-200/20 bg-[linear-gradient(180deg,rgba(25,88,114,0.28),rgba(11,30,44,0.62))] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]",
                      ].join(" ")}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div
                          className={[
                            "text-xs uppercase tracking-[0.18em]",
                            isExternal ? "text-amber-100/72" : "text-cyan-100/62",
                          ].join(" ")}
                        >
                          {isExternal ? "Внешний вход" : "Номенклатура"}
                        </div>
                        <div className="flex items-center gap-2">
                          <IconActionButton label="Редактировать" onClick={() => onEditInput(input)}>
                            <PencilLine className="h-3.5 w-3.5" />
                          </IconActionButton>
                          <IconActionButton
                            label="Удалить"
                            onClick={() => onDeleteInput(input)}
                            disabled={isDeletingInput}
                            tone="danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconActionButton>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <div className="text-base font-medium text-slate-50">{buildInputTitle(input)}</div>
                        <div className="text-right">
                          <div className="text-xl font-semibold text-slate-50">
                            {formatQty(input.input_qty)}
                          </div>
                          {!isExternal ? (
                            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                              {input.input_nomenclature_uom || "ед."}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
                  <Cog className="h-4 w-4" />
                </div>
                <div className="text-lg font-medium text-slate-50">Оборудование шага</div>
              </div>
              <button
                type="button"
                onClick={onOpenCreateEquipment}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-cyan-50 transition hover:bg-cyan-400/18"
              >
                <Plus className="h-3.5 w-3.5" />
                Добавить оборудование
              </button>
            </div>

            {isEquipmentLoading ? (
              <div className="rounded-none border border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,26,37,0.58),rgba(10,18,27,0.7))] px-4 py-4 text-sm text-slate-400">
                Загрузка оборудования шага...
              </div>
            ) : equipmentError ? (
              <div className="rounded-none border border-rose-300/30 bg-rose-500/[0.1] px-4 py-4 text-sm text-rose-100">
                {equipmentError}
              </div>
            ) : equipment.length === 0 ? (
              <div className="rounded-none border border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,26,37,0.58),rgba(10,18,27,0.7))] px-4 py-4 text-sm text-slate-400">
                Для этого шага пока нет оборудования. Добавьте первую единицу.
              </div>
            ) : (
              <div className="space-y-3">
                {equipment.map((equipmentItem) => {
                  const isPrimary = equipmentItem.equipment_role === "primary";

                  return (
                    <div
                      key={equipmentItem.step_equipment_id}
                      className={[
                        "rounded-none border px-4 py-4",
                        isPrimary
                          ? "border-cyan-200/20 bg-[linear-gradient(180deg,rgba(25,88,114,0.28),rgba(11,30,44,0.62))] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]"
                          : "border-slate-200/18 bg-[linear-gradient(180deg,rgba(52,63,82,0.28),rgba(19,25,34,0.62))] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
                      ].join(" ")}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div
                          className={[
                            "text-xs uppercase tracking-[0.18em]",
                            isPrimary ? "text-cyan-100/62" : "text-slate-300/78",
                          ].join(" ")}
                        >
                          {getEquipmentRoleLabel(equipmentItem.equipment_role)}
                        </div>
                        <div className="flex items-center gap-2">
                          <IconActionButton
                            label="Редактировать"
                            onClick={() => onEditEquipment(equipmentItem)}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </IconActionButton>
                          <IconActionButton
                            label="Удалить"
                            onClick={() => onDeleteEquipment(equipmentItem)}
                            disabled={isDeletingEquipment}
                            tone="danger"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconActionButton>
                        </div>
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-medium text-slate-50">
                            {buildEquipmentTitle(equipmentItem)}
                          </div>
                          <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                            Приоритет {equipmentItem.priority}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-semibold text-slate-50">
                            {formatQty(equipmentItem.nominal_rate)}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                            {equipmentItem.rate_uom || "ед./мин"}
                          </div>
                          {!equipmentItem.is_active ? (
                            <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-amber-200/80">
                              Неактивно
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="mt-6 rounded-none border border-cyan-300/8 bg-[linear-gradient(180deg,rgba(18,31,43,0.72),rgba(10,19,29,0.76))] px-4 py-5 text-sm text-slate-300">
          Выберите шаг в цепочке или создайте новый шаг маршрута.
        </div>
      )}
    </aside>
  );
}

export default StepDetailsPanel;
