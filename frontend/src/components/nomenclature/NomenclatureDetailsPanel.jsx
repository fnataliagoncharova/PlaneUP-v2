import {
  ArrowRight,
  Boxes,
  ChevronDown,
  ChevronRight,
  GitBranch,
  PencilLine,
  ScrollText,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

function getItemTypeLabel(itemType) {
  return itemType === "purchased" ? "Закупаемая" : "Производимая";
}

function buildInputKey(parentPath, input, inputIndex) {
  if (input?.step_input_id !== null && input?.step_input_id !== undefined) {
    return `${parentPath}/input-${input.step_input_id}`;
  }

  return `${parentPath}/input-${input?.input_nomenclature_id ?? "unknown"}-${inputIndex}`;
}

function getFirstRouteStep(node) {
  const steps = Array.isArray(node?.route?.steps) ? node.route.steps : [];
  return steps[0] ?? null;
}

function formatRouteHours(hoursValue) {
  if (hoursValue === null || hoursValue === undefined || hoursValue === "") {
    return "";
  }

  const rawValue = String(hoursValue).trim();
  if (!rawValue) {
    return "";
  }

  const normalizedValue = rawValue.replace(",", ".");
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    return rawValue;
  }

  if (Number.isInteger(parsedValue)) {
    return String(parsedValue);
  }

  if (!normalizedValue.includes(".")) {
    return String(parsedValue);
  }

  return normalizedValue.replace(/0+$/, "").replace(/\.$/, "");
}

function collectTopLevelExpandedKeys(node, path = "root") {
  const result = [];
  const firstStep = getFirstRouteStep(node);
  const inputs = Array.isArray(firstStep?.inputs) ? firstStep.inputs : [];

  inputs.forEach((input, inputIndex) => {
    if (!input?.child_chain) {
      return;
    }

    result.push(buildInputKey(path, input, inputIndex));
  });

  return result;
}

function RouteChainBadge({ itemType }) {
  const isPurchased = itemType === "purchased";

  return (
    <span
      className={[
        "ml-2 inline-flex items-center rounded-none border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
        isPurchased
          ? "border-amber-300/38 bg-amber-400/[0.12] text-amber-100"
          : "border-cyan-200/24 bg-cyan-300/10 text-cyan-100/80",
      ].join(" ")}
    >
      {isPurchased ? "Закупаемая" : "Производимая"}
    </span>
  );
}

function buildTreePrefix(lineage, isLast) {
  return {
    depth: lineage.length,
    hasChildrenBelow: !isLast,
    lineage,
  };
}

function RouteChainBranchContent({
  node,
  path,
  expandedKeys,
  onToggleExpand,
  showNodeHeader = false,
  lineage = [],
}) {
  const firstStep = getFirstRouteStep(node);
  const inputs = Array.isArray(firstStep?.inputs) ? firstStep.inputs : [];
  const hasRoute = Boolean(node?.route);
  const processName = firstStep?.process_name || "не указана";
  const postProcessWaitHours = firstStep?.post_process_wait_hours;
  const formattedPostProcessWaitHours = formatRouteHours(postProcessWaitHours);

  return (
    <div className="space-y-1.5">
      {showNodeHeader ? (
        <div className="inline-flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-cyan-100/85">{node.nomenclature_code}</span>
          <span className="text-slate-500">—</span>
          <span className="font-semibold text-cyan-50">{node.nomenclature_name}</span>
          <RouteChainBadge itemType={node.item_type} />
        </div>
      ) : null}

      {hasRoute ? (
        <div className="text-sm">
          <span className="text-slate-500">Операция: </span>
          <span className="text-slate-300">{processName}</span>
        </div>
      ) : (
        <div className="text-sm text-slate-400">Активный маршрут получения не найден.</div>
      )}

      {postProcessWaitHours !== null && postProcessWaitHours !== undefined ? (
        <div className="text-sm">
          <span className="text-slate-500">Дегазация: </span>
          <span className="text-amber-100/90">{formattedPostProcessWaitHours} ч</span>
        </div>
      ) : null}

      {hasRoute && inputs.length > 0 ? (
        <div className="mt-1">
          <ul className="space-y-1">
            {inputs.map((input, inputIndex) => (
              <RouteChainInputRow
                key={
                  input.step_input_id ??
                  `${path}-${input.input_nomenclature_id ?? "unknown"}-${inputIndex}`
                }
                input={input}
                path={buildInputKey(path, input, inputIndex)}
                expandedKeys={expandedKeys}
                onToggleExpand={onToggleExpand}
                isLast={inputIndex === inputs.length - 1}
                lineage={lineage}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function RouteChainInputRow({
  input,
  path,
  expandedKeys,
  onToggleExpand,
  isLast = false,
  lineage = [],
}) {
  const hasChildChain = Boolean(input?.child_chain);
  const isExpanded = hasChildChain && expandedKeys.has(path);
  const isPurchased = input?.input_item_type === "purchased";
  const treePrefix = buildTreePrefix(lineage, isLast);
  const childLineage = [...lineage, isLast];
  const connectorStep = 14;
  const connectorLeft = treePrefix.depth * connectorStep + 4;
  const connectorWidth = 12;
  const prefixWidth = connectorLeft + connectorWidth;

  return (
    <li className="py-1">
      <div className="flex items-start gap-2">
        <div className="relative mt-1 h-5 shrink-0" style={{ width: `${prefixWidth}px` }}>
          {treePrefix.lineage.map((isParentLast, depthIndex) =>
            isParentLast ? null : (
              <span
                key={`lineage-${depthIndex}`}
                className="pointer-events-none absolute -bottom-2 -top-2 border-l border-cyan-300/38"
                style={{ left: `${depthIndex * connectorStep + 4}px` }}
                aria-hidden="true"
              />
            ),
          )}
          <span
            className={[
              "pointer-events-none absolute border-l border-cyan-300/45",
              treePrefix.hasChildrenBelow ? "bottom-[-0.5rem] top-0" : "top-0 h-[0.62rem]",
            ].join(" ")}
            style={{ left: `${connectorLeft}px` }}
            aria-hidden="true"
          />
          <span
            className="pointer-events-none absolute border-t border-cyan-300/45"
            style={{ left: `${connectorLeft}px`, top: "0.62rem", width: `${connectorWidth}px` }}
            aria-hidden="true"
          />
        </div>

        {hasChildChain ? (
          <button
            type="button"
            onClick={() => onToggleExpand(path)}
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-cyan-300/26 bg-cyan-400/[0.06] text-cyan-100 transition hover:bg-cyan-400/[0.14]"
            aria-label={isExpanded ? "Свернуть компонент" : "Развернуть компонент"}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span
            className={[
              "mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
              isPurchased ? "bg-amber-200/80" : "bg-cyan-200/80",
            ].join(" ")}
            aria-hidden="true"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="inline-flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-sm">
              <span className="mr-1 font-medium text-slate-200/90">
                {input.input_nomenclature_code}
              </span>
              <span className="mr-1 text-slate-500">—</span>
              <span className="font-semibold text-slate-50">{input.input_nomenclature_name}</span>
            </span>
            <RouteChainBadge itemType={input.input_item_type} />
          </div>
        </div>
      </div>

      {hasChildChain && isExpanded ? (
        <div className="mt-1 pl-10">
          <RouteChainBranchContent
            node={input.child_chain}
            path={path}
            expandedKeys={expandedKeys}
            onToggleExpand={onToggleExpand}
            lineage={childLineage}
          />
        </div>
      ) : null}
    </li>
  );
}

function RouteChainSection({ routeChain, isRouteChainLoading, routeChainError }) {
  const topLevelExpandedKeys = useMemo(
    () => collectTopLevelExpandedKeys(routeChain),
    [routeChain],
  );
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());

  useEffect(() => {
    setExpandedKeys(new Set(topLevelExpandedKeys));
  }, [topLevelExpandedKeys]);

  const warnings = Array.isArray(routeChain?.warnings) ? routeChain.warnings : [];
  const handleToggleExpand = useCallback((key) => {
    setExpandedKeys((currentValue) => {
      const nextValue = new Set(currentValue);
      if (nextValue.has(key)) {
        nextValue.delete(key);
      } else {
        nextValue.add(key);
      }
      return nextValue;
    });
  }, []);

  if (isRouteChainLoading) {
    return (
      <div className="rounded-none border border-cyan-300/20 bg-cyan-500/[0.05] px-4 py-4 text-sm text-slate-300">
        Загружаем полный маршрут...
      </div>
    );
  }

  if (routeChainError) {
    return (
      <div className="rounded-none border border-rose-300/26 bg-rose-500/[0.08] px-4 py-4 text-sm text-rose-100">
        {routeChainError}
      </div>
    );
  }

  if (!routeChain) {
    return (
      <div className="rounded-none border border-cyan-300/16 bg-slate-900/35 px-4 py-4 text-sm text-slate-400">
        Полный маршрут недоступен.
      </div>
    );
  }

  return (
    <div className="rounded-none border border-cyan-100/20 bg-[linear-gradient(180deg,rgba(17,62,81,0.16),rgba(8,22,33,0.55))] px-4 py-4">
      <p className="text-xs leading-5 text-slate-300">
        Показаны производимые полуфабрикаты и закупаемые входы полного маршрута получения.
      </p>

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-none border border-amber-300/26 bg-amber-500/[0.08] px-3 py-3 text-sm text-amber-100">
          <div className="text-[11px] uppercase tracking-[0.16em] text-amber-100/75">
            Предупреждения
          </div>
          <ul className="mt-2 space-y-1">
            {warnings.map((warning, warningIndex) => (
              <li key={`${warning}-${warningIndex}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3">
        <RouteChainBranchContent
          node={routeChain}
          path={`root-${routeChain.nomenclature_id}`}
          expandedKeys={expandedKeys}
          onToggleExpand={handleToggleExpand}
          showNodeHeader
        />
      </div>
    </div>
  );
}

function NomenclatureDetailsPanel({
  item,
  onEdit,
  productionRoute,
  productionRouteSteps,
  isProductionRouteLoading,
  productionRouteError,
  onOpenRoute,
  routeChain,
  isRouteChainLoading,
  routeChainError,
}) {
  if (!item) {
    return (
      <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
        <div className="flex min-h-[420px] items-center justify-center text-center">
          <div className="max-w-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center text-cyan-100">
              <Boxes className="h-8 w-8" />
            </div>
            <h2 className="mt-6 font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">
              Позиция не выбрана
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Выберите позицию в списке слева, чтобы посмотреть карточку номенклатуры.
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
          <div className="panel-title">Выбранная позиция</div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            {item.nomenclature_name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]"
        >
          <PencilLine className="h-3.5 w-3.5" />
          Редактировать
        </button>
      </div>

      <div className="panel-divider mt-5" />

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Карточка позиции</div>
        </div>

        <div className="rounded-none border border-cyan-100/56 bg-[linear-gradient(180deg,rgba(32,174,207,0.34),rgba(16,78,107,0.82))] px-5 py-5 shadow-[0_0_0_1px_rgba(125,246,255,0.2),inset_0_1px_0_rgba(255,255,255,0.08),0_0_40px_rgba(34,211,238,0.28)]">
          <div className="text-sm uppercase tracking-[0.22em] text-cyan-100/72">
            {item.nomenclature_code}
          </div>
          <div className="mt-3 text-[1.36rem] font-semibold leading-tight text-cyan-50">
            {item.nomenclature_name}
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.2em] text-cyan-100/60">
            Единица: {item.unit_of_measure}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-100/60">
            Тип: {getItemTypeLabel(item.item_type)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.2em] text-cyan-100/60">
            Активность: {item.is_active ? "Активна" : "Неактивна"}
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <ScrollText className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Маршрут получения позиции</div>
        </div>

        {isProductionRouteLoading ? (
          <div className="rounded-none border border-cyan-300/20 bg-cyan-500/[0.05] px-4 py-4 text-sm text-slate-300">
            Загружаем маршрут...
          </div>
        ) : productionRouteError ? (
          <div className="rounded-none border border-rose-300/26 bg-rose-500/[0.08] px-4 py-4 text-sm text-rose-100">
            {productionRouteError}
          </div>
        ) : !productionRoute ? (
          <div className="rounded-none border border-cyan-300/16 bg-slate-900/35 px-4 py-4 text-sm text-slate-400">
            Маршрут не задан
          </div>
        ) : (
          <div className="rounded-none border border-cyan-100/22 bg-[linear-gradient(180deg,rgba(19,76,98,0.2),rgba(8,27,40,0.72))] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">
              {productionRoute.route_code}
            </div>
            <div className="mt-2 text-base font-medium text-cyan-50">
              {productionRoute.route_name}
            </div>

            <div className="mt-4 text-xs uppercase tracking-[0.16em] text-slate-500">Шаги</div>
            {productionRouteSteps.length === 0 ? (
              <div className="mt-2 text-sm text-slate-400">Шаги маршрута не добавлены.</div>
            ) : (
              <ol className="mt-2 space-y-2">
                {productionRouteSteps.map((step) => (
                  <li
                    key={step.route_step_id}
                    className="border border-cyan-300/12 bg-cyan-500/[0.04] px-3 py-2 text-sm text-slate-200"
                  >
                    {step.step_no}. {step.process_label}
                  </li>
                ))}
              </ol>
            )}

            <button
              type="button"
              onClick={onOpenRoute}
              className="mt-4 inline-flex items-center gap-2 rounded-none border border-cyan-400/28 bg-cyan-400/10 px-3.5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-50 transition hover:bg-cyan-400/16"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Открыть маршрут
            </button>
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center text-cyan-100">
            <GitBranch className="h-4 w-4" />
          </div>
          <div className="text-lg font-medium text-slate-50">Полный маршрут получения</div>
        </div>
        <RouteChainSection
          routeChain={routeChain}
          isRouteChainLoading={isRouteChainLoading}
          routeChainError={routeChainError}
        />
      </section>
    </aside>
  );
}

export default NomenclatureDetailsPanel;
