import { AlertCircle, Plus, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import NomenclatureDetailsPanel from "../components/nomenclature/NomenclatureDetailsPanel";
import NomenclatureFormPanel from "../components/nomenclature/NomenclatureFormPanel";
import NomenclatureImportPanel from "../components/nomenclature/NomenclatureImportPanel";
import NomenclatureList from "../components/nomenclature/NomenclatureList";
import {
  commitNomenclatureImport,
  createNomenclatureItem,
  downloadNomenclatureImportTemplate,
  getNomenclatureList,
  previewNomenclatureImport,
  updateNomenclatureItem,
} from "../services/nomenclatureApi";
import { getProcessesList } from "../services/processesApi";
import { getRouteStepsList } from "../services/routeStepsApi";
import { getRoutesList } from "../services/routesApi";

function sortByCode(items) {
  return [...items].sort((left, right) =>
    left.nomenclature_code.localeCompare(right.nomenclature_code, "ru"),
  );
}

function getDefaultSelection(items) {
  if (items.length === 0) {
    return null;
  }

  const preferredItem = items.find((item) => item.nomenclature_code === "NM-004");
  return preferredItem?.nomenclature_id ?? items[0].nomenclature_id;
}

function pickRouteByResultNomenclature(routes, nomenclatureId) {
  const matchedRoutes = routes.filter(
    (route) => route.result_nomenclature_id === nomenclatureId,
  );

  if (matchedRoutes.length === 0) {
    return null;
  }

  return [...matchedRoutes].sort((left, right) => {
    if (left.is_active !== right.is_active) {
      return Number(right.is_active) - Number(left.is_active);
    }

    return left.route_code.localeCompare(right.route_code, "ru");
  })[0];
}

function buildStepProcessLabel(step, processById) {
  const processItem = processById.get(step.process_id);

  if (!processItem) {
    return `Операция #${step.process_id}`;
  }

  if (processItem.process_name) {
    return processItem.process_name;
  }

  return processItem.process_code || `Операция #${step.process_id}`;
}

function NomenclatureSection({ onOpenRoute }) {
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [selectedProductionRoute, setSelectedProductionRoute] = useState(null);
  const [selectedProductionRouteSteps, setSelectedProductionRouteSteps] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRouteContextLoading, setIsRouteContextLoading] = useState(true);
  const [isRouteStepsLoading, setIsRouteStepsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [routeContextError, setRouteContextError] = useState("");
  const [routeStepsError, setRouteStepsError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importMode, setImportMode] = useState("upsert");
  const [importFile, setImportFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [importError, setImportError] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isCommitLoading, setIsCommitLoading] = useState(false);
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);

  const reloadNomenclature = useCallback(async () => {
    const response = await getNomenclatureList();
    const sortedItems = sortByCode(response);

    setItems(sortedItems);
    setSelectedItemId((currentSelectedId) => {
      if (sortedItems.some((item) => item.nomenclature_id === currentSelectedId)) {
        return currentSelectedId;
      }
      return getDefaultSelection(sortedItems);
    });
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadNomenclatureData() {
      setIsLoading(true);
      setLoadError("");

      try {
        if (isCancelled) {
          return;
        }

        await reloadNomenclature();
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setLoadError(error.message || "Не удалось загрузить список номенклатуры.");
        setItems([]);
        setSelectedItemId(null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadNomenclatureData();

    return () => {
      isCancelled = true;
    };
  }, [reloadNomenclature]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) => {
      const codeMatches = item.nomenclature_code.toLowerCase().includes(normalizedSearch);
      const nameMatches = item.nomenclature_name.toLowerCase().includes(normalizedSearch);

      return codeMatches || nameMatches;
    });
  }, [items, searchValue]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      return;
    }

    const hasSelectedItem = filteredItems.some((item) => item.nomenclature_id === selectedItemId);

    if (!hasSelectedItem) {
      setSelectedItemId(filteredItems[0].nomenclature_id);
    }
  }, [filteredItems, selectedItemId]);

  const selectedItem = items.find((item) => item.nomenclature_id === selectedItemId) ?? null;
  const selectedNomenclatureId = selectedItem?.nomenclature_id ?? null;
  const processById = useMemo(
    () => new Map(processes.map((process) => [process.process_id, process])),
    [processes],
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadRouteContext() {
      setIsRouteContextLoading(true);
      setRouteContextError("");

      try {
        const [routesResponse, processesResponse] = await Promise.all([
          getRoutesList(),
          getProcessesList(),
        ]);

        if (isCancelled) {
          return;
        }

        setRoutes(routesResponse);
        setProcesses(processesResponse);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setRoutes([]);
        setProcesses([]);
        setRouteContextError(error.message || "Не удалось загрузить маршруты номенклатуры.");
      } finally {
        if (!isCancelled) {
          setIsRouteContextLoading(false);
        }
      }
    }

    loadRouteContext();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedNomenclatureId) {
      setSelectedProductionRoute(null);
      setSelectedProductionRouteSteps([]);
      setRouteStepsError("");
      setIsRouteStepsLoading(false);
      return;
    }

    if (isRouteContextLoading) {
      return;
    }

    if (routeContextError) {
      setSelectedProductionRoute(null);
      setSelectedProductionRouteSteps([]);
      setIsRouteStepsLoading(false);
      return;
    }

    const nextRoute = pickRouteByResultNomenclature(routes, selectedNomenclatureId);

    if (!nextRoute) {
      setSelectedProductionRoute(null);
      setSelectedProductionRouteSteps([]);
      setRouteStepsError("");
      setIsRouteStepsLoading(false);
      return;
    }

    setSelectedProductionRoute(nextRoute);

    let isCancelled = false;

    async function loadProductionRouteSteps() {
      setIsRouteStepsLoading(true);
      setRouteStepsError("");

      try {
        const response = await getRouteStepsList(nextRoute.route_id);

        if (isCancelled) {
          return;
        }

        const normalizedSteps = [...response]
          .sort((left, right) => left.step_no - right.step_no)
          .map((step) => ({
            route_step_id: step.route_step_id,
            step_no: step.step_no,
            process_label: buildStepProcessLabel(step, processById),
          }));

        setSelectedProductionRouteSteps(normalizedSteps);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setSelectedProductionRouteSteps([]);
        setRouteStepsError(error.message || "Не удалось загрузить шаги маршрута.");
      } finally {
        if (!isCancelled) {
          setIsRouteStepsLoading(false);
        }
      }
    }

    loadProductionRouteSteps();

    return () => {
      isCancelled = true;
    };
  }, [
    isRouteContextLoading,
    processById,
    routeContextError,
    routes,
    selectedNomenclatureId,
  ]);

  const handleOpenRoute = useCallback(() => {
    if (!selectedProductionRoute || !onOpenRoute) {
      return;
    }

    onOpenRoute(selectedProductionRoute.route_id);
  }, [onOpenRoute, selectedProductionRoute]);

  const handleOpenCreateForm = () => {
    setFormMode("create");
    setSaveError("");
    setIsImportOpen(false);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = () => {
    if (!selectedItem) {
      return;
    }

    setFormMode("edit");
    setSaveError("");
    setIsImportOpen(false);
    setIsFormOpen(true);
  };

  const handleCancelForm = () => {
    if (isSaving) {
      return;
    }

    setSaveError("");
    setIsFormOpen(false);
  };

  const handleSubmitForm = async (payload) => {
    setIsSaving(true);
    setSaveError("");

    try {
      if (formMode === "create") {
        const createdItem = await createNomenclatureItem(payload);
        const nextItems = sortByCode([...items, createdItem]);

        setItems(nextItems);
        setSearchValue("");
        setSelectedItemId(createdItem.nomenclature_id);
      } else if (selectedItem) {
        const updatedItem = await updateNomenclatureItem(selectedItem.nomenclature_id, payload);
        const nextItems = sortByCode(
          items.map((item) =>
            item.nomenclature_id === selectedItem.nomenclature_id ? updatedItem : item,
          ),
        );

        setItems(nextItems);
        setSelectedItemId(updatedItem.nomenclature_id);
      }

      setIsFormOpen(false);
    } catch (error) {
      setSaveError(error.message || "Не удалось сохранить изменения.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportMode("upsert");
    setPreviewData(null);
    setCommitResult(null);
    setImportError("");
    setIsPreviewLoading(false);
    setIsCommitLoading(false);
  };

  const handleOpenImportPanel = () => {
    setIsFormOpen(false);
    resetImportState();
    setIsImportOpen(true);
  };

  const handleCloseImportPanel = () => {
    if (isPreviewLoading || isCommitLoading) {
      return;
    }

    setIsImportOpen(false);
    setImportError("");
  };

  const handleImportFileChange = (nextFile) => {
    setImportFile(nextFile);
    setPreviewData(null);
    setCommitResult(null);
    setImportError("");
  };

  const handleImportModeChange = (nextMode) => {
    setImportMode(nextMode);
    setPreviewData(null);
    setCommitResult(null);
    setImportError("");
  };

  const handlePreviewImport = async () => {
    if (!importFile) {
      setImportError("Выберите Excel-файл для предпросмотра.");
      return;
    }

    setIsPreviewLoading(true);
    setImportError("");
    setCommitResult(null);

    try {
      const response = await previewNomenclatureImport(importFile, importMode);
      setPreviewData(response);
    } catch (error) {
      setPreviewData(null);
      setImportError(error.message || "Не удалось подготовить предпросмотр импорта.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importFile) {
      setImportError("Выберите Excel-файл для импорта.");
      return;
    }

    if (!previewData) {
      setImportError("Сначала выполните предпросмотр файла.");
      return;
    }

    setIsCommitLoading(true);
    setImportError("");

    try {
      const response = await commitNomenclatureImport(importFile, importMode);
      setCommitResult(response);
      await reloadNomenclature();
    } catch (error) {
      setImportError(error.message || "Не удалось выполнить импорт номенклатуры.");
    } finally {
      setIsCommitLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setIsTemplateDownloading(true);
    setImportError("");

    try {
      const templateBlob = await downloadNomenclatureImportTemplate();
      const url = URL.createObjectURL(templateBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "nomenclature_import_template.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setImportError(error.message || "Не удалось скачать шаблон Excel.");
    } finally {
      setIsTemplateDownloading(false);
    }
  };

  const formItem = formMode === "edit" ? selectedItem : null;

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(0,0.88fr)] 2xl:grid-cols-[minmax(0,1.24fr)_minmax(0,0.92fr)]">
      <div className="space-y-6">
        <header className="glass-panel p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="font-['Space_Grotesk'] text-3xl font-semibold text-slate-50 sm:text-4xl">
                Номенклатура
              </h1>
            </div>

            <div className="flex flex-nowrap items-center gap-3">
              <button
                type="button"
                onClick={handleOpenCreateForm}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
              >
                <Plus className="h-4 w-4" />
                Новая позиция
              </button>
              <button
                type="button"
                onClick={handleOpenImportPanel}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
              >
                <Upload className="h-4 w-4" />
                Импорт Excel
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

        <NomenclatureList
          items={filteredItems}
          isLoading={isLoading}
          selectedItemId={selectedItem?.nomenclature_id ?? null}
          onSelectItem={setSelectedItemId}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />
      </div>

      {isImportOpen ? (
        <NomenclatureImportPanel
          importMode={importMode}
          selectedFile={importFile}
          previewData={previewData}
          commitResult={commitResult}
          errorMessage={importError}
          isPreviewLoading={isPreviewLoading}
          isCommitLoading={isCommitLoading}
          onImportModeChange={handleImportModeChange}
          onFileChange={handleImportFileChange}
          onPreview={handlePreviewImport}
          onCommit={handleCommitImport}
          onCancel={handleCloseImportPanel}
          onDownloadTemplate={handleDownloadTemplate}
          isTemplateDownloading={isTemplateDownloading}
        />
      ) : isFormOpen ? (
        <NomenclatureFormPanel
          mode={formMode}
          item={formItem}
          isSaving={isSaving}
          errorMessage={saveError}
          onCancel={handleCancelForm}
          onSave={handleSubmitForm}
        />
      ) : (
        <NomenclatureDetailsPanel
          item={filteredItems.length > 0 ? selectedItem : null}
          onEdit={handleOpenEditForm}
          productionRoute={selectedProductionRoute}
          productionRouteSteps={selectedProductionRouteSteps}
          isProductionRouteLoading={isRouteContextLoading || isRouteStepsLoading}
          productionRouteError={routeContextError || routeStepsError}
          onOpenRoute={handleOpenRoute}
        />
      )}
    </section>
  );
}

export default NomenclatureSection;
