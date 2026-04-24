import { AlertCircle, GitBranchPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import V2ConfirmDialog from "../components/common/V2ConfirmDialog";
import RouteFormPanel from "../components/routes/RouteFormPanel";
import RouteList from "../components/routes/RouteList";
import RouteStepFormPanel from "../components/routes/RouteStepFormPanel";
import RouteStepInputFormPanel from "../components/routes/RouteStepInputFormPanel";
import RouteStepsFlow from "../components/routes/RouteStepsFlow";
import StepDetailsPanel from "../components/routes/StepDetailsPanel";
import { getNomenclatureList } from "../services/nomenclatureApi";
import { getProcessesList } from "../services/processesApi";
import {
  createRouteStepInputItem,
  deleteRouteStepInputItem,
  getRouteStepInputsList,
  updateRouteStepInputItem,
} from "../services/routeStepInputsApi";
import {
  createRouteStepItem,
  deleteRouteStepItem,
  getRouteStepsList,
  updateRouteStepItem,
} from "../services/routeStepsApi";
import {
  createRouteItem,
  deleteRouteItem,
  getRouteItem,
  getRoutesList,
  updateRouteItem,
} from "../services/routesApi";

function sortRoutesByCode(items) {
  return [...items].sort((left, right) => left.route_code.localeCompare(right.route_code, "ru"));
}

function sortNomenclatureByCode(items) {
  return [...items].sort((left, right) =>
    left.nomenclature_code.localeCompare(right.nomenclature_code, "ru"),
  );
}

function sortProcessesByCode(items) {
  return [...items].sort((left, right) =>
    left.process_code.localeCompare(right.process_code, "ru"),
  );
}

function sortStepsByNo(items) {
  return [...items].sort((left, right) => left.step_no - right.step_no);
}

function sortInputsById(items) {
  return [...items].sort((left, right) => left.step_input_id - right.step_input_id);
}

function getDefaultRouteSelection(items) {
  if (items.length === 0) {
    return null;
  }

  const preferredItem = items.find((item) => item.route_code === "RT-001");
  return preferredItem?.route_id ?? items[0].route_id;
}

function buildProcessLabel(step) {
  if (!step) {
    return "Не выбрана";
  }

  if (step.process_code && step.process_name) {
    return `${step.process_code} — ${step.process_name}`;
  }

  return step.process_name || "Не выбрана";
}

function buildNomenclatureLabel(step) {
  if (!step) {
    return "Не выбрана";
  }

  if (step.output_nomenclature_code && step.output_nomenclature_name) {
    return `${step.output_nomenclature_code} — ${step.output_nomenclature_name}`;
  }

  return step.output_nomenclature_name || "Не выбрана";
}

const ROUTE_AUTODEACTIVATION_MESSAGE =
  "После изменения маршрут стал неактивным. Активируйте его повторно после проверки.";

function RoutesSection() {
  const [routes, setRoutes] = useState([]);
  const [routeSteps, setRouteSteps] = useState([]);
  const [routeStepInputs, setRouteStepInputs] = useState([]);
  const [nomenclatureItems, setNomenclatureItems] = useState([]);
  const [processItems, setProcessItems] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [selectedInputId, setSelectedInputId] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isStepsLoading, setIsStepsLoading] = useState(false);
  const [isInputsLoading, setIsInputsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [stepsError, setStepsError] = useState("");
  const [inputsError, setInputsError] = useState("");

  const [routeSaveError, setRouteSaveError] = useState("");
  const [stepSaveError, setStepSaveError] = useState("");
  const [inputSaveError, setInputSaveError] = useState("");
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isChangingRouteStatus, setIsChangingRouteStatus] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isSavingInput, setIsSavingInput] = useState(false);
  const [isDeletingStep, setIsDeletingStep] = useState(false);
  const [isDeletingInput, setIsDeletingInput] = useState(false);
  const [isDeleteStepConfirmOpen, setIsDeleteStepConfirmOpen] = useState(false);
  const [isDeleteInputConfirmOpen, setIsDeleteInputConfirmOpen] = useState(false);
  const [inputPendingDeleteId, setInputPendingDeleteId] = useState(null);
  const [routeStatusError, setRouteStatusError] = useState("");
  const [routeStatusNotice, setRouteStatusNotice] = useState("");

  const [activePanel, setActivePanel] = useState("view");
  const [routeFormMode, setRouteFormMode] = useState("create");
  const [stepFormMode, setStepFormMode] = useState("create");
  const [inputFormMode, setInputFormMode] = useState("create");

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setIsLoading(true);
      setLoadError("");

      try {
        const [routesResponse, nomenclatureResponse, processesResponse] = await Promise.all([
          getRoutesList(),
          getNomenclatureList(),
          getProcessesList(),
        ]);

        if (isCancelled) {
          return;
        }

        const sortedRoutes = sortRoutesByCode(routesResponse);
        setRoutes(sortedRoutes);
        setNomenclatureItems(sortNomenclatureByCode(nomenclatureResponse));
        setProcessItems(sortProcessesByCode(processesResponse));
        setSelectedRouteId(getDefaultRouteSelection(sortedRoutes));
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setLoadError(error.message || "Не удалось загрузить маршруты.");
        setRoutes([]);
        setRouteSteps([]);
        setRouteStepInputs([]);
        setNomenclatureItems([]);
        setProcessItems([]);
        setSelectedRouteId(null);
        setSelectedStepId(null);
        setSelectedInputId(null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (routes.length === 0) {
      if (selectedRouteId !== null) {
        setSelectedRouteId(null);
      }
      return;
    }

    const hasSelectedRoute = routes.some((route) => route.route_id === selectedRouteId);

    if (!hasSelectedRoute) {
      setSelectedRouteId(routes[0].route_id);
    }
  }, [routes, selectedRouteId]);

  useEffect(() => {
    if (!selectedRouteId) {
      setRouteSteps([]);
      setSelectedStepId(null);
      setStepsError("");
      return;
    }

    let isCancelled = false;

    async function loadRouteSteps() {
      setIsStepsLoading(true);
      setStepsError("");

      try {
        const response = await getRouteStepsList(selectedRouteId);

        if (isCancelled) {
          return;
        }

        const sortedSteps = sortStepsByNo(response);
        setRouteSteps(sortedSteps);
        setSelectedStepId((previousStepId) => {
          const hasPreviousSelection = sortedSteps.some(
            (step) => step.route_step_id === previousStepId,
          );

          if (hasPreviousSelection) {
            return previousStepId;
          }

          return sortedSteps[0]?.route_step_id ?? null;
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setRouteSteps([]);
        setSelectedStepId(null);
        setStepsError(error.message || "Не удалось загрузить шаги маршрута.");
      } finally {
        if (!isCancelled) {
          setIsStepsLoading(false);
        }
      }
    }

    loadRouteSteps();

    return () => {
      isCancelled = true;
    };
  }, [selectedRouteId]);

  const selectedRoute = routes.find((route) => route.route_id === selectedRouteId) ?? null;

  useEffect(() => {
    setRouteStatusError("");
    setRouteStatusNotice("");
  }, [selectedRouteId]);

  const nomenclatureById = useMemo(
    () => new Map(nomenclatureItems.map((item) => [item.nomenclature_id, item])),
    [nomenclatureItems],
  );

  const processById = useMemo(
    () => new Map(processItems.map((item) => [item.process_id, item])),
    [processItems],
  );

  const getResultNomenclatureLabel = useCallback(
    (nomenclatureId) => {
      const nomenclatureItem = nomenclatureById.get(nomenclatureId);

      if (!nomenclatureItem) {
        return "Не выбрана";
      }

      return `${nomenclatureItem.nomenclature_code} — ${nomenclatureItem.nomenclature_name}`;
    },
    [nomenclatureById],
  );

  const hydratedSteps = useMemo(
    () =>
      routeSteps.map((step) => {
        const processItem = processById.get(step.process_id);
        const nomenclatureItem = nomenclatureById.get(step.output_nomenclature_id);

        return {
          ...step,
          process_code: processItem?.process_code,
          process_name: processItem?.process_name,
          output_nomenclature_code: nomenclatureItem?.nomenclature_code,
          output_nomenclature_name: nomenclatureItem?.nomenclature_name,
          output_nomenclature_uom: nomenclatureItem?.unit_of_measure,
        };
      }),
    [nomenclatureById, processById, routeSteps],
  );

  const selectedStep =
    hydratedSteps.find((step) => step.route_step_id === selectedStepId) ?? hydratedSteps[0] ?? null;

  useEffect(() => {
    if (hydratedSteps.length === 0 && selectedStepId !== null) {
      setSelectedStepId(null);
    }
  }, [hydratedSteps, selectedStepId]);

  useEffect(() => {
    const routeStepId = selectedStep?.route_step_id;

    if (!routeStepId) {
      setRouteStepInputs([]);
      setSelectedInputId(null);
      setInputsError("");
      setIsInputsLoading(false);
      return;
    }

    let isCancelled = false;

    async function loadRouteStepInputs() {
      setIsInputsLoading(true);
      setInputsError("");

      try {
        const response = await getRouteStepInputsList(routeStepId);

        if (isCancelled) {
          return;
        }

        setRouteStepInputs(sortInputsById(response));
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setRouteStepInputs([]);
        setInputsError(error.message || "Не удалось загрузить входы шага.");
      } finally {
        if (!isCancelled) {
          setIsInputsLoading(false);
        }
      }
    }

    loadRouteStepInputs();

    return () => {
      isCancelled = true;
    };
  }, [selectedStep?.route_step_id]);

  useEffect(() => {
    if (selectedInputId === null) {
      return;
    }

    const hasSelectedInput = routeStepInputs.some((input) => input.step_input_id === selectedInputId);
    if (!hasSelectedInput) {
      setSelectedInputId(null);
    }
  }, [routeStepInputs, selectedInputId]);

  useEffect(() => {
    if (!selectedStep && isDeleteStepConfirmOpen) {
      setIsDeleteStepConfirmOpen(false);
    }
  }, [isDeleteStepConfirmOpen, selectedStep]);

  useEffect(() => {
    if (!selectedStep && activePanel === "input-form") {
      setActivePanel("view");
    }
  }, [activePanel, selectedStep]);

  useEffect(() => {
    if (inputPendingDeleteId === null) {
      return;
    }

    const hasPendingInput = routeStepInputs.some(
      (input) => input.step_input_id === inputPendingDeleteId,
    );

    if (!hasPendingInput) {
      setIsDeleteInputConfirmOpen(false);
      setInputPendingDeleteId(null);
    }
  }, [inputPendingDeleteId, routeStepInputs]);

  const hydratedInputs = useMemo(
    () =>
      routeStepInputs.map((input) => {
        const nomenclatureItem = input.input_nomenclature_id
          ? nomenclatureById.get(input.input_nomenclature_id)
          : null;

        return {
          ...input,
          input_nomenclature_code: nomenclatureItem?.nomenclature_code,
          input_nomenclature_name: nomenclatureItem?.nomenclature_name,
          input_nomenclature_uom: nomenclatureItem?.unit_of_measure,
        };
      }),
    [nomenclatureById, routeStepInputs],
  );

  const selectedInput =
    hydratedInputs.find((input) => input.step_input_id === selectedInputId) ?? null;

  const selectedResultNomenclatureLabel = selectedRoute
    ? getResultNomenclatureLabel(selectedRoute.result_nomenclature_id)
    : "Не выбрана";

  const selectedStepProcessLabel = buildProcessLabel(selectedStep);
  const selectedStepNomenclatureLabel = buildNomenclatureLabel(selectedStep);

  const replaceRouteInState = useCallback((updatedRoute) => {
    setRoutes((previousRoutes) =>
      sortRoutesByCode(
        previousRoutes.map((route) =>
          route.route_id === updatedRoute.route_id ? updatedRoute : route,
        ),
      ),
    );
    setSelectedRouteId(updatedRoute.route_id);
  }, []);

  const syncRouteAfterStructuralChange = useCallback(
    async (routeId, wasRouteActiveBefore) => {
      try {
        const refreshedRoute = await getRouteItem(routeId);
        replaceRouteInState(refreshedRoute);

        if (wasRouteActiveBefore && !refreshedRoute.is_active) {
          setRouteStatusNotice(ROUTE_AUTODEACTIVATION_MESSAGE);
        } else {
          setRouteStatusNotice("");
        }
      } catch (error) {
        setRouteStatusError(error.message || "Не удалось обновить статус маршрута.");
      }
    },
    [replaceRouteInState],
  );

  const handleOpenCreateRouteForm = () => {
    setRouteFormMode("create");
    setRouteSaveError("");
    setRouteStatusError("");
    setRouteStatusNotice("");
    setActivePanel("route-form");
  };

  const handleOpenEditRouteForm = () => {
    if (!selectedRoute) {
      return;
    }

    setRouteFormMode("edit");
    setRouteSaveError("");
    setRouteStatusError("");
    setRouteStatusNotice("");
    setActivePanel("route-form");
  };

  const handleCancelRouteForm = () => {
    if (isSavingRoute) {
      return;
    }

    setRouteSaveError("");
    setActivePanel("view");
  };

  const handleSubmitRouteForm = async (payload) => {
    setIsSavingRoute(true);
    setRouteSaveError("");
    setRouteStatusError("");
    setRouteStatusNotice("");

    try {
      if (routeFormMode === "create") {
        const createdRoute = await createRouteItem({
          ...payload,
          is_active: false,
        });
        const nextRoutes = sortRoutesByCode([...routes, createdRoute]);

        setRoutes(nextRoutes);
        setSelectedRouteId(createdRoute.route_id);
      } else if (selectedRoute) {
        const updatedRoute = await updateRouteItem(selectedRoute.route_id, {
          ...payload,
          is_active: selectedRoute.is_active,
        });
        replaceRouteInState(updatedRoute);
      }

      setActivePanel("view");
    } catch (error) {
      setRouteSaveError(error.message || "Не удалось сохранить маршрут.");
    } finally {
      setIsSavingRoute(false);
    }
  };

  const handleActivateRoute = async () => {
    if (!selectedRoute || selectedRoute.is_active) {
      return;
    }

    setIsChangingRouteStatus(true);
    setRouteStatusError("");
    setRouteStatusNotice("");

    try {
      const updatedRoute = await updateRouteItem(selectedRoute.route_id, {
        route_code: selectedRoute.route_code,
        route_name: selectedRoute.route_name,
        result_nomenclature_id: selectedRoute.result_nomenclature_id,
        is_active: true,
      });

      replaceRouteInState(updatedRoute);
    } catch (error) {
      setRouteStatusError(error.message || "Не удалось активировать маршрут.");
    } finally {
      setIsChangingRouteStatus(false);
    }
  };

  const handleDeactivateRoute = async () => {
    if (!selectedRoute || !selectedRoute.is_active) {
      return;
    }

    setIsChangingRouteStatus(true);
    setRouteStatusError("");
    setRouteStatusNotice("");

    try {
      const deactivatedRoute = await deleteRouteItem(selectedRoute.route_id);
      replaceRouteInState(deactivatedRoute);
    } catch (error) {
      setRouteStatusError(error.message || "Не удалось деактивировать маршрут.");
    } finally {
      setIsChangingRouteStatus(false);
    }
  };

  const handleOpenCreateStepForm = () => {
    if (!selectedRoute) {
      return;
    }

    setStepFormMode("create");
    setStepSaveError("");
    setActivePanel("step-form");
  };

  const handleOpenEditStepForm = () => {
    if (!selectedStep) {
      return;
    }

    setStepFormMode("edit");
    setStepSaveError("");
    setActivePanel("step-form");
  };

  const handleCancelStepForm = () => {
    if (isSavingStep) {
      return;
    }

    setStepSaveError("");
    setActivePanel("view");
  };

  const handleSubmitStepForm = async (payload) => {
    if (!selectedRoute) {
      return;
    }

    const routeId = selectedRoute.route_id;
    const wasRouteActive = selectedRoute.is_active;

    setIsSavingStep(true);
    setStepSaveError("");
    setRouteStatusError("");

    try {
      if (stepFormMode === "create") {
        const createdStep = await createRouteStepItem(selectedRoute.route_id, payload);
        const nextSteps = sortStepsByNo([...routeSteps, createdStep]);

        setRouteSteps(nextSteps);
        setSelectedStepId(createdStep.route_step_id);
      } else if (selectedStep) {
        const updatedStep = await updateRouteStepItem(selectedStep.route_step_id, payload);
        const nextSteps = sortStepsByNo(
          routeSteps.map((step) =>
            step.route_step_id === selectedStep.route_step_id ? updatedStep : step,
          ),
        );

        setRouteSteps(nextSteps);
        setSelectedStepId(updatedStep.route_step_id);
      }

      await syncRouteAfterStructuralChange(routeId, wasRouteActive);
      setActivePanel("view");
    } catch (error) {
      setStepSaveError(error.message || "Не удалось сохранить шаг маршрута.");
    } finally {
      setIsSavingStep(false);
    }
  };

  const handleOpenDeleteStepConfirm = () => {
    if (!selectedStep || isDeletingStep) {
      return;
    }

    setIsDeleteStepConfirmOpen(true);
  };

  const handleCancelDeleteStepConfirm = () => {
    if (isDeletingStep) {
      return;
    }

    setIsDeleteStepConfirmOpen(false);
  };

  const handleConfirmDeleteStep = async () => {
    if (!selectedStep) {
      return;
    }

    const routeId = selectedRoute?.route_id ?? null;
    const wasRouteActive = Boolean(selectedRoute?.is_active);

    setIsDeleteStepConfirmOpen(false);
    setIsDeletingStep(true);
    setStepsError("");
    setRouteStatusError("");

    try {
      const deletedStep = await deleteRouteStepItem(selectedStep.route_step_id);
      const nextSteps = sortStepsByNo(
        routeSteps.filter((step) => step.route_step_id !== deletedStep.route_step_id),
      );

      setRouteSteps(nextSteps);
      setRouteStepInputs([]);
      setSelectedInputId(null);
      setSelectedStepId(nextSteps[0]?.route_step_id ?? null);
      setStepSaveError("");
      setInputSaveError("");
      setInputsError("");

      if (routeId) {
        await syncRouteAfterStructuralChange(routeId, wasRouteActive);
      }

      if (activePanel === "step-form" || activePanel === "input-form") {
        setActivePanel("view");
      }
    } catch (error) {
      setStepsError(error.message || "Не удалось удалить шаг маршрута.");
    } finally {
      setIsDeletingStep(false);
    }
  };

  const handleOpenCreateInputForm = () => {
    if (!selectedStep) {
      return;
    }

    setInputFormMode("create");
    setSelectedInputId(null);
    setInputSaveError("");
    setActivePanel("input-form");
  };

  const handleOpenEditInputForm = (input) => {
    if (!selectedStep || !input) {
      return;
    }

    setInputFormMode("edit");
    setSelectedInputId(input.step_input_id);
    setInputSaveError("");
    setActivePanel("input-form");
  };

  const handleCancelInputForm = () => {
    if (isSavingInput) {
      return;
    }

    setInputSaveError("");
    setActivePanel("view");
  };

  const handleSubmitInputForm = async (payload) => {
    if (!selectedStep) {
      return;
    }

    const routeId = selectedRoute?.route_id ?? null;
    const wasRouteActive = Boolean(selectedRoute?.is_active);

    setIsSavingInput(true);
    setInputSaveError("");
    setRouteStatusError("");

    try {
      if (inputFormMode === "create") {
        const createdInput = await createRouteStepInputItem(selectedStep.route_step_id, payload);
        const nextInputs = sortInputsById([...routeStepInputs, createdInput]);

        setRouteStepInputs(nextInputs);
        setSelectedInputId(createdInput.step_input_id);
      } else if (selectedInput) {
        const updatedInput = await updateRouteStepInputItem(selectedInput.step_input_id, payload);
        const nextInputs = sortInputsById(
          routeStepInputs.map((input) =>
            input.step_input_id === selectedInput.step_input_id ? updatedInput : input,
          ),
        );

        setRouteStepInputs(nextInputs);
        setSelectedInputId(updatedInput.step_input_id);
      }

      if (routeId) {
        await syncRouteAfterStructuralChange(routeId, wasRouteActive);
      }

      setActivePanel("view");
    } catch (error) {
      setInputSaveError(error.message || "Не удалось сохранить вход шага.");
    } finally {
      setIsSavingInput(false);
    }
  };

  const handleOpenDeleteInputConfirm = (input) => {
    if (!input || isDeletingInput) {
      return;
    }

    setInputPendingDeleteId(input.step_input_id);
    setIsDeleteInputConfirmOpen(true);
  };

  const handleCancelDeleteInputConfirm = () => {
    if (isDeletingInput) {
      return;
    }

    setIsDeleteInputConfirmOpen(false);
    setInputPendingDeleteId(null);
  };

  const handleConfirmDeleteInput = async () => {
    if (inputPendingDeleteId === null) {
      return;
    }

    const routeId = selectedRoute?.route_id ?? null;
    const wasRouteActive = Boolean(selectedRoute?.is_active);

    const deletingInputId = inputPendingDeleteId;
    setIsDeleteInputConfirmOpen(false);
    setIsDeletingInput(true);
    setInputsError("");
    setRouteStatusError("");

    try {
      const deletedInput = await deleteRouteStepInputItem(deletingInputId);
      const nextInputs = sortInputsById(
        routeStepInputs.filter((input) => input.step_input_id !== deletedInput.step_input_id),
      );

      setRouteStepInputs(nextInputs);
      setInputSaveError("");

      if (routeId) {
        await syncRouteAfterStructuralChange(routeId, wasRouteActive);
      }

      if (selectedInputId === deletedInput.step_input_id) {
        setSelectedInputId(null);
      }

      if (activePanel === "input-form" && selectedInputId === deletedInput.step_input_id) {
        setActivePanel("view");
      }
    } catch (error) {
      setInputsError(error.message || "Не удалось удалить вход шага.");
    } finally {
      setIsDeletingInput(false);
      setInputPendingDeleteId(null);
    }
  };

  const routeFormItem = routeFormMode === "edit" ? selectedRoute : null;
  const stepFormItem = stepFormMode === "edit" ? selectedStep : null;
  const inputFormItem = inputFormMode === "edit" ? selectedInput : null;

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(0,0.88fr)] 2xl:grid-cols-[minmax(0,1.24fr)_minmax(0,0.92fr)]">
        <div className="space-y-6">
          <header className="glass-panel p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <h1 className="font-['Space_Grotesk'] text-3xl font-semibold text-slate-50 sm:text-4xl">
                  Маршруты
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                  Этап 3 маршрутов: шапка маршрута, шаги и входы шага подключены к backend API.
                  Оборудование шага остаётся следующим этапом.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleOpenCreateRouteForm}
                  className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
                >
                  <GitBranchPlus className="h-4 w-4" />
                  Новый маршрут
                </button>
              </div>
            </div>

            {loadError ? (
              <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{loadError}</span>
              </div>
            ) : null}
          </header>

          <RouteStepsFlow
            steps={hydratedSteps}
            selectedStepId={selectedStepId}
            onSelectStep={setSelectedStepId}
            onAddStep={handleOpenCreateStepForm}
            isLoading={isStepsLoading}
            errorMessage={stepsError}
            isRouteSelected={Boolean(selectedRoute)}
          />

          <RouteList
            routes={routes}
            isLoading={isLoading}
            selectedRouteId={selectedRouteId}
            onSelectRoute={setSelectedRouteId}
            getResultNomenclatureLabel={getResultNomenclatureLabel}
          />
        </div>

        {activePanel === "route-form" ? (
          <RouteFormPanel
            mode={routeFormMode}
            item={routeFormItem}
            nomenclatureItems={nomenclatureItems}
            isSaving={isSavingRoute}
            errorMessage={routeSaveError}
            onCancel={handleCancelRouteForm}
            onSave={handleSubmitRouteForm}
          />
        ) : activePanel === "step-form" ? (
          <RouteStepFormPanel
            mode={stepFormMode}
            item={stepFormItem}
            processItems={processItems}
            nomenclatureItems={nomenclatureItems}
            routeSteps={routeSteps}
            isSaving={isSavingStep}
            errorMessage={stepSaveError}
            onCancel={handleCancelStepForm}
            onSave={handleSubmitStepForm}
          />
        ) : activePanel === "input-form" ? (
          <RouteStepInputFormPanel
            mode={inputFormMode}
            item={inputFormItem}
            nomenclatureItems={nomenclatureItems}
            isSaving={isSavingInput}
            errorMessage={inputSaveError}
            onCancel={handleCancelInputForm}
            onSave={handleSubmitInputForm}
          />
        ) : (
          <StepDetailsPanel
            selectedRoute={selectedRoute}
            selectedResultNomenclatureLabel={selectedResultNomenclatureLabel}
            step={selectedStep}
            processLabel={selectedStepProcessLabel}
            outputNomenclatureLabel={selectedStepNomenclatureLabel}
            outputNomenclatureUom={selectedStep?.output_nomenclature_uom}
            onEditRoute={handleOpenEditRouteForm}
            onActivateRoute={handleActivateRoute}
            onDeactivateRoute={handleDeactivateRoute}
            isChangingRouteStatus={isChangingRouteStatus}
            routeStatusError={routeStatusError}
            routeStatusNotice={routeStatusNotice}
            onOpenCreateStep={handleOpenCreateStepForm}
            onEditStep={handleOpenEditStepForm}
            onDeleteStep={handleOpenDeleteStepConfirm}
            isDeletingStep={isDeletingStep}
            inputs={hydratedInputs}
            isInputsLoading={isInputsLoading}
            inputsError={inputsError}
            onOpenCreateInput={handleOpenCreateInputForm}
            onEditInput={handleOpenEditInputForm}
            onDeleteInput={handleOpenDeleteInputConfirm}
            isDeletingInput={isDeletingInput}
          />
        )}
      </section>

      <V2ConfirmDialog
        isOpen={isDeleteStepConfirmOpen}
        title={selectedStep ? `Удалить шаг ${selectedStep.step_no}?` : "Удалить шаг?"}
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={handleConfirmDeleteStep}
        onCancel={handleCancelDeleteStepConfirm}
        isConfirmDisabled={isDeletingStep}
        isCancelDisabled={isDeletingStep}
      />

      <V2ConfirmDialog
        isOpen={isDeleteInputConfirmOpen}
        title="Удалить вход шага?"
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={handleConfirmDeleteInput}
        onCancel={handleCancelDeleteInputConfirm}
        isConfirmDisabled={isDeletingInput}
        isCancelDisabled={isDeletingInput}
      />
    </>
  );
}

export default RoutesSection;
