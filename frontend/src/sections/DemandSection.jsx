import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Package,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SquareChartGantt,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import V2ConfirmDialog from "../components/common/V2ConfirmDialog";
import NomenclatureSearchSelect from "../components/shared/NomenclatureSearchSelect";
import InventoryBalanceImportPanel from "../components/reports/InventoryBalanceImportPanel";
import SafetyStockImportPanel from "../components/reports/SafetyStockImportPanel";
import SalesPlanImportPanel from "../components/reports/SalesPlanImportPanel";
import { getNomenclatureList } from "../services/nomenclatureApi";
import {
  commitInventoryBalanceImport,
  createInventoryBalanceItem,
  deleteInventoryBalanceItem,
  getInventoryBalanceDates,
  getInventoryBalanceImportTemplateUrl,
  getInventoryBalanceList,
  previewInventoryBalanceImport,
  updateInventoryBalanceItem,
} from "../services/inventoryBalanceApi";
import {
  commitSafetyStockImport,
  createSafetyStockItem,
  deleteSafetyStockItem,
  getSafetyStockImportTemplateUrl,
  getSafetyStockList,
  previewSafetyStockImport,
  updateSafetyStockItem,
} from "../services/safetyStockApi";
import {
  commitSalesPlanImport,
  createSalesPlanItem,
  deleteSalesPlanItem,
  getSalesPlanImportTemplateUrl,
  getSalesPlanList,
  previewSalesPlanImport,
  updateSalesPlanItem,
} from "../services/salesPlanApi";
import { calculateDemand } from "../services/demandApi";

const MODULE_TAB_SOURCE_DATA = "source_data";
const MODULE_TAB_CALCULATE = "demand_calculate";
const MODULE_TAB_RESULTS = "demand_results";

const IMPORT_CONTEXT_SALES_PLAN = "sales_plan";
const IMPORT_CONTEXT_INVENTORY_BALANCE = "inventory_balance";
const IMPORT_CONTEXT_SAFETY_STOCK = "safety_stock";

const MODULE_TABS = [
  { id: MODULE_TAB_SOURCE_DATA, label: "Исходные данные" },
  { id: MODULE_TAB_CALCULATE, label: "Расчёт потребности" },
  { id: MODULE_TAB_RESULTS, label: "Результаты" },
];

const TAB_BUTTON_BASE_CLASS =
  "inline-flex h-10 w-[190px] items-center justify-center rounded-none border px-4 text-center text-sm font-medium transition";

function getCurrentDateValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  const localDate = new Date(now.getTime() - timezoneOffsetMs);
  return localDate.toISOString().slice(0, 10);
}

function getCurrentMonthValue() {
  return getCurrentDateValue().slice(0, 7);
}

function monthToApiDate(monthValue) {
  if (!monthValue) {
    return "";
  }
  return `${monthValue}-01`;
}

function formatMonthLabel(monthValue) {
  if (!monthValue) {
    return "—";
  }
  return monthValue;
}

function formatQty(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) {
    return value;
  }

  return asNumber.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function filterItemsBySearch(items, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return items;
  }

  return items.filter((item) => {
    const code = String(item.nomenclature_code || "").toLowerCase();
    const name = String(item.nomenclature_name || "").toLowerCase();
    return code.includes(normalizedQuery) || name.includes(normalizedQuery);
  });
}

function resolveStatusMeta({ isLoading, error, items }) {
  if (isLoading) {
    return {
      label: "Загрузка",
      className: "text-cyan-200/85",
    };
  }

  if (error) {
    return {
      label: "Ошибка",
      className: "text-rose-200/90",
    };
  }

  if (items.length > 0) {
    return {
      label: "Загружено",
      className: "text-emerald-200/85",
    };
  }

  return {
    label: "Нет данных",
    className: "text-slate-400",
  };
}

function IconActionButton({ label, onClick, disabled = false, tone = "edit", children }) {
  const toneClassName =
    tone === "danger"
      ? "border-rose-300/22 bg-rose-500/[0.06] text-rose-100/90 hover:border-rose-300/38 hover:bg-rose-500/[0.14]"
      : "border-cyan-300/18 bg-cyan-400/[0.04] text-slate-200 hover:border-cyan-300/30 hover:bg-cyan-400/[0.11] hover:text-cyan-50";

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

function DemandSection() {
  const [activeModuleTab, setActiveModuleTab] = useState(MODULE_TAB_SOURCE_DATA);
  const [activeSourceTab, setActiveSourceTab] = useState(IMPORT_CONTEXT_SALES_PLAN);

  const [planMonth, setPlanMonth] = useState(getCurrentMonthValue);
  const [salesPlanItems, setSalesPlanItems] = useState([]);
  const [isSalesPlanLoading, setIsSalesPlanLoading] = useState(true);
  const [salesPlanError, setSalesPlanError] = useState("");
  const [salesPlanSearch, setSalesPlanSearch] = useState("");

  const [balanceDate, setBalanceDate] = useState("");
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isInventoryLoading, setIsInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryBalanceDates, setInventoryBalanceDates] = useState([]);
  const [isInventoryDatesLoading, setIsInventoryDatesLoading] = useState(true);
  const [inventoryDatesError, setInventoryDatesError] = useState("");

  const [safetyStockItems, setSafetyStockItems] = useState([]);
  const [isSafetyStockLoading, setIsSafetyStockLoading] = useState(true);
  const [safetyStockError, setSafetyStockError] = useState("");
  const [safetyStockSearch, setSafetyStockSearch] = useState("");

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importContext, setImportContext] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [importError, setImportError] = useState("");
  const [importErrorContext, setImportErrorContext] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isCommitLoading, setIsCommitLoading] = useState(false);
  const [nomenclatureItems, setNomenclatureItems] = useState([]);
  const [isNomenclatureLoading, setIsNomenclatureLoading] = useState(false);
  const [isSalesPlanFormOpen, setIsSalesPlanFormOpen] = useState(false);
  const [salesPlanFormMode, setSalesPlanFormMode] = useState("create");
  const [salesPlanFormItem, setSalesPlanFormItem] = useState(null);
  const [salesPlanFormError, setSalesPlanFormError] = useState("");
  const [isSalesPlanSaving, setIsSalesPlanSaving] = useState(false);
  const [salesPlanFormNomenclatureId, setSalesPlanFormNomenclatureId] = useState("");
  const [salesPlanFormQty, setSalesPlanFormQty] = useState("");
  const [salesPlanDeleteCandidate, setSalesPlanDeleteCandidate] = useState(null);
  const [salesPlanDeleteError, setSalesPlanDeleteError] = useState("");
  const [deletingSalesPlanId, setDeletingSalesPlanId] = useState(null);
  const [isInventoryFormOpen, setIsInventoryFormOpen] = useState(false);
  const [inventoryFormMode, setInventoryFormMode] = useState("create");
  const [inventoryFormItem, setInventoryFormItem] = useState(null);
  const [inventoryFormError, setInventoryFormError] = useState("");
  const [isInventorySaving, setIsInventorySaving] = useState(false);
  const [inventoryFormNomenclatureId, setInventoryFormNomenclatureId] = useState("");
  const [inventoryFormQty, setInventoryFormQty] = useState("");
  const [inventoryDeleteCandidate, setInventoryDeleteCandidate] = useState(null);
  const [inventoryDeleteError, setInventoryDeleteError] = useState("");
  const [deletingInventoryId, setDeletingInventoryId] = useState(null);
  const [isSafetyStockFormOpen, setIsSafetyStockFormOpen] = useState(false);
  const [safetyStockFormMode, setSafetyStockFormMode] = useState("create");
  const [safetyStockFormItem, setSafetyStockFormItem] = useState(null);
  const [safetyStockFormError, setSafetyStockFormError] = useState("");
  const [isSafetyStockSaving, setIsSafetyStockSaving] = useState(false);
  const [safetyStockFormNomenclatureId, setSafetyStockFormNomenclatureId] = useState("");
  const [safetyStockFormQty, setSafetyStockFormQty] = useState("");
  const [safetyStockDeleteCandidate, setSafetyStockDeleteCandidate] = useState(null);
  const [safetyStockDeleteError, setSafetyStockDeleteError] = useState("");
  const [deletingSafetyStockId, setDeletingSafetyStockId] = useState(null);
  const [demandResult, setDemandResult] = useState(null);
  const [isDemandCalculating, setIsDemandCalculating] = useState(false);
  const [demandCalculateError, setDemandCalculateError] = useState("");
  const [lastCalculatedAt, setLastCalculatedAt] = useState("");
  const [lastCalculationParams, setLastCalculationParams] = useState(null);

  const reloadSalesPlan = useCallback(async () => {
    setIsSalesPlanLoading(true);
    setSalesPlanError("");

    try {
      const response = await getSalesPlanList(monthToApiDate(planMonth));
      setSalesPlanItems(Array.isArray(response) ? response : []);
    } catch (error) {
      setSalesPlanItems([]);
      setSalesPlanError(error.message || "Не удалось загрузить план продаж.");
    } finally {
      setIsSalesPlanLoading(false);
    }
  }, [planMonth]);

  const reloadInventoryBalance = useCallback(async () => {
    if (!balanceDate) {
      setInventoryItems([]);
      setInventoryError("");
      setIsInventoryLoading(false);
      return;
    }

    setIsInventoryLoading(true);
    setInventoryError("");

    try {
      const response = await getInventoryBalanceList(balanceDate);
      setInventoryItems(Array.isArray(response) ? response : []);
    } catch (error) {
      setInventoryItems([]);
      setInventoryError(error.message || "Не удалось загрузить остатки.");
    } finally {
      setIsInventoryLoading(false);
    }
  }, [balanceDate]);

  const reloadInventoryBalanceDates = useCallback(async () => {
    setIsInventoryDatesLoading(true);
    setInventoryDatesError("");

    try {
      const response = await getInventoryBalanceDates();
      const dates = Array.isArray(response) ? response : [];
      setInventoryBalanceDates(dates);

      if (dates.length === 0) {
        setBalanceDate("");
      } else if (!balanceDate || !dates.includes(balanceDate)) {
        setBalanceDate(dates[0]);
      }
    } catch (error) {
      setInventoryBalanceDates([]);
      setInventoryDatesError(error.message || "Не удалось загрузить список дат остатков.");
    } finally {
      setIsInventoryDatesLoading(false);
    }
  }, [balanceDate]);

  const reloadSafetyStock = useCallback(async () => {
    setIsSafetyStockLoading(true);
    setSafetyStockError("");

    try {
      const response = await getSafetyStockList();
      setSafetyStockItems(Array.isArray(response) ? response : []);
    } catch (error) {
      setSafetyStockItems([]);
      setSafetyStockError(error.message || "Не удалось загрузить страховой запас.");
    } finally {
      setIsSafetyStockLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadSalesPlan();
  }, [reloadSalesPlan]);

  useEffect(() => {
    reloadInventoryBalanceDates();
  }, [reloadInventoryBalanceDates]);

  useEffect(() => {
    reloadInventoryBalance();
  }, [reloadInventoryBalance]);

  useEffect(() => {
    reloadSafetyStock();
  }, [reloadSafetyStock]);

  useEffect(() => {
    if (activeSourceTab !== IMPORT_CONTEXT_SALES_PLAN) {
      setIsSalesPlanFormOpen(false);
      setSalesPlanFormError("");
      setSalesPlanDeleteError("");
      setSalesPlanDeleteCandidate(null);
      setSalesPlanFormItem(null);
      setSalesPlanFormQty("");
      setSalesPlanFormNomenclatureId("");
    }

    if (activeSourceTab !== IMPORT_CONTEXT_INVENTORY_BALANCE) {
      setIsInventoryFormOpen(false);
      setInventoryFormError("");
      setInventoryDeleteError("");
      setInventoryDeleteCandidate(null);
      setInventoryFormItem(null);
      setInventoryFormQty("");
      setInventoryFormNomenclatureId("");
    }

    if (activeSourceTab !== IMPORT_CONTEXT_SAFETY_STOCK) {
      setIsSafetyStockFormOpen(false);
      setSafetyStockFormError("");
      setSafetyStockDeleteError("");
      setSafetyStockDeleteCandidate(null);
      setSafetyStockFormItem(null);
      setSafetyStockFormQty("");
      setSafetyStockFormNomenclatureId("");
    }
  }, [activeSourceTab]);

  const loadNomenclatureItems = useCallback(async () => {
    if (isNomenclatureLoading || nomenclatureItems.length > 0) {
      return;
    }

    setIsNomenclatureLoading(true);
    try {
      const response = await getNomenclatureList();
      setNomenclatureItems(Array.isArray(response) ? response : []);
    } catch {
      if (activeSourceTab === IMPORT_CONTEXT_INVENTORY_BALANCE) {
        setInventoryFormError("Не удалось загрузить номенклатуру.");
      } else if (activeSourceTab === IMPORT_CONTEXT_SAFETY_STOCK) {
        setSafetyStockFormError("Не удалось загрузить номенклатуру.");
      } else {
        setSalesPlanFormError("Не удалось загрузить номенклатуру.");
      }
    } finally {
      setIsNomenclatureLoading(false);
    }
  }, [activeSourceTab, isNomenclatureLoading, nomenclatureItems.length]);

  const filteredSalesPlanItems = useMemo(
    () => filterItemsBySearch(salesPlanItems, salesPlanSearch),
    [salesPlanItems, salesPlanSearch],
  );
  const filteredInventoryItems = useMemo(
    () => filterItemsBySearch(inventoryItems, inventorySearch),
    [inventoryItems, inventorySearch],
  );
  const filteredSafetyStockItems = useMemo(
    () => filterItemsBySearch(safetyStockItems, safetyStockSearch),
    [safetyStockItems, safetyStockSearch],
  );
  const demandTopLevelItems = useMemo(
    () => (Array.isArray(demandResult?.top_level_demand) ? demandResult.top_level_demand : []),
    [demandResult],
  );
  const demandInternalItems = useMemo(
    () =>
      Array.isArray(demandResult?.internal_production_demand) ? demandResult.internal_production_demand : [],
    [demandResult],
  );
  const demandExternalItems = useMemo(
    () => (Array.isArray(demandResult?.external_demand) ? demandResult.external_demand : []),
    [demandResult],
  );
  const demandProblemItems = useMemo(
    () => (Array.isArray(demandResult?.problems) ? demandResult.problems : []),
    [demandResult],
  );

  const salesPlanStatus = resolveStatusMeta({
    isLoading: isSalesPlanLoading,
    error: salesPlanError,
    items: salesPlanItems,
  });
  const inventoryStatus = resolveStatusMeta({
    isLoading: isInventoryLoading,
    error: inventoryError,
    items: inventoryItems,
  });
  const safetyStockStatus = resolveStatusMeta({
    isLoading: isSafetyStockLoading,
    error: safetyStockError,
    items: safetyStockItems,
  });

  const summaryCards = [
    {
      id: IMPORT_CONTEXT_SALES_PLAN,
      title: "План продаж",
      icon: SquareChartGantt,
      iconClassName:
        "border-cyan-300/24 bg-cyan-400/[0.08] text-cyan-100",
      rowsCount: salesPlanItems.length,
      dateText: `Месяц плана: ${formatMonthLabel(planMonth)}`,
      status: salesPlanStatus,
    },
    {
      id: IMPORT_CONTEXT_INVENTORY_BALANCE,
      title: "Остатки",
      icon: Package,
      iconClassName:
        "border-amber-300/28 bg-amber-400/[0.1] text-amber-100",
      rowsCount: inventoryItems.length,
      dateText:
        inventoryBalanceDates.length === 0
          ? "Нет снимков"
          : balanceDate
            ? `Дата остатков: ${balanceDate}`
            : "Дата остатков: —",
      dateBadgeText:
        inventoryBalanceDates.length === 0
          ? "нет снимков"
          : balanceDate && balanceDate === inventoryBalanceDates[0]
            ? "последняя загрузка"
            : "выбранный снимок",
      status: inventoryStatus,
    },
    {
      id: IMPORT_CONTEXT_SAFETY_STOCK,
      title: "Страховой запас",
      icon: ShieldCheck,
      iconClassName:
        "border-emerald-300/28 bg-emerald-400/[0.1] text-emerald-100",
      rowsCount: safetyStockItems.length,
      dateText: "Без даты",
      status: safetyStockStatus,
    },
  ];

  const resetImportState = useCallback(() => {
    setImportFile(null);
    setPreviewData(null);
    setCommitResult(null);
    setImportError("");
  }, []);

  const handleOpenImportPanel = (context) => {
    setImportContext(context);
    setImportErrorContext(context);
    resetImportState();
    setIsImportOpen(true);
  };

  const handleCloseImportPanel = () => {
    if (isPreviewLoading || isCommitLoading) {
      return;
    }

    setImportError("");
    setIsImportOpen(false);
  };

  const handleDownloadTemplate = (context = importContext) => {
    if (!context) {
      return;
    }

    setImportError("");
    setImportErrorContext(context);

    try {
      let url = "";
      let fileName = "";

      if (context === IMPORT_CONTEXT_SALES_PLAN) {
        url = getSalesPlanImportTemplateUrl();
        fileName = "sales_plan_import_template.xlsx";
      } else if (context === IMPORT_CONTEXT_INVENTORY_BALANCE) {
        url = getInventoryBalanceImportTemplateUrl();
        fileName = "inventory_balance_import_template.xlsx";
      } else {
        url = getSafetyStockImportTemplateUrl();
        fileName = "safety_stock_import_template.xlsx";
      }

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      setImportError(error.message || "Не удалось скачать шаблон Excel.");
    }
  };

  const handleImportFileChange = (nextFile) => {
    setImportFile(nextFile);
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
      let response = null;

      if (importContext === IMPORT_CONTEXT_SALES_PLAN) {
        response = await previewSalesPlanImport(importFile);
      } else if (importContext === IMPORT_CONTEXT_INVENTORY_BALANCE) {
        response = await previewInventoryBalanceImport(importFile);
      } else {
        response = await previewSafetyStockImport(importFile);
      }

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
      let response = null;

      if (importContext === IMPORT_CONTEXT_SALES_PLAN) {
        response = await commitSalesPlanImport(importFile);
      } else if (importContext === IMPORT_CONTEXT_INVENTORY_BALANCE) {
        response = await commitInventoryBalanceImport(importFile);
      } else {
        response = await commitSafetyStockImport(importFile);
      }

      setCommitResult(response);

      if (importContext === IMPORT_CONTEXT_SALES_PLAN) {
        await reloadSalesPlan();
      } else if (importContext === IMPORT_CONTEXT_INVENTORY_BALANCE) {
        await reloadInventoryBalanceDates();
        await reloadInventoryBalance();
      } else {
        await reloadSafetyStock();
      }
    } catch (error) {
      setImportError(error.message || "Не удалось выполнить импорт.");
    } finally {
      setIsCommitLoading(false);
    }
  };

  const renderImportPanel = () => {
    if (!isImportOpen) {
      return null;
    }

    if (importContext === IMPORT_CONTEXT_INVENTORY_BALANCE) {
      return (
        <InventoryBalanceImportPanel
          selectedFile={importFile}
          previewData={previewData}
          commitResult={commitResult}
          errorMessage={importError}
          isPreviewLoading={isPreviewLoading}
          isCommitLoading={isCommitLoading}
          onFileChange={handleImportFileChange}
          onPreview={handlePreviewImport}
          onCommit={handleCommitImport}
          onCancel={handleCloseImportPanel}
          onDownloadTemplate={() => handleDownloadTemplate(IMPORT_CONTEXT_INVENTORY_BALANCE)}
        />
      );
    }

    if (importContext === IMPORT_CONTEXT_SAFETY_STOCK) {
      return (
        <SafetyStockImportPanel
          selectedFile={importFile}
          previewData={previewData}
          commitResult={commitResult}
          errorMessage={importError}
          isPreviewLoading={isPreviewLoading}
          isCommitLoading={isCommitLoading}
          onFileChange={handleImportFileChange}
          onPreview={handlePreviewImport}
          onCommit={handleCommitImport}
          onCancel={handleCloseImportPanel}
          onDownloadTemplate={() => handleDownloadTemplate(IMPORT_CONTEXT_SAFETY_STOCK)}
        />
      );
    }

    return (
      <SalesPlanImportPanel
        selectedFile={importFile}
        previewData={previewData}
        commitResult={commitResult}
        errorMessage={importError}
        isPreviewLoading={isPreviewLoading}
        isCommitLoading={isCommitLoading}
        onFileChange={handleImportFileChange}
        onPreview={handlePreviewImport}
        onCommit={handleCommitImport}
        onCancel={handleCloseImportPanel}
        onDownloadTemplate={() => handleDownloadTemplate(IMPORT_CONTEXT_SALES_PLAN)}
        isTemplateDownloading={false}
      />
    );
  };

  const handleCalculateDemand = async () => {
    setDemandCalculateError("");

    if (!planMonth) {
      setDemandCalculateError("Для расчёта потребности выберите период планирования.");
      return;
    }

    if (!balanceDate) {
      setDemandCalculateError("Для расчёта потребности выберите дату остатков.");
      return;
    }

    const payload = {
      plan_date: monthToApiDate(planMonth),
      balance_date: balanceDate,
      nomenclature_ids: null,
    };

    setIsDemandCalculating(true);
    try {
      const response = await calculateDemand(payload);
      setDemandResult(response || null);
      setLastCalculationParams(payload);
      setLastCalculatedAt(new Date().toISOString());
    } catch (error) {
      setDemandCalculateError(error.message || "Не удалось выполнить расчёт потребности.");
    } finally {
      setIsDemandCalculating(false);
    }
  };

  const handleOpenCreateSalesPlanForm = async () => {
    setSalesPlanFormMode("create");
    setSalesPlanFormItem(null);
    setSalesPlanFormError("");
    setSalesPlanFormQty("");
    setSalesPlanFormNomenclatureId("");
    setIsSalesPlanFormOpen(true);
    await loadNomenclatureItems();
  };

  const handleOpenEditSalesPlanForm = (item) => {
    setSalesPlanFormMode("edit");
    setSalesPlanFormItem(item);
    setSalesPlanFormError("");
    setSalesPlanFormNomenclatureId(String(item.nomenclature_id));
    setSalesPlanFormQty(String(item.plan_qty ?? ""));
    setIsSalesPlanFormOpen(true);
  };

  const handleCloseSalesPlanForm = () => {
    if (isSalesPlanSaving) {
      return;
    }
    setIsSalesPlanFormOpen(false);
    setSalesPlanFormError("");
  };

  const handleSaveSalesPlanForm = async () => {
    const normalizedQtyText = String(salesPlanFormQty ?? "").replace(",", ".").trim();
    const parsedQty = Number(normalizedQtyText);
    if (!normalizedQtyText || !Number.isFinite(parsedQty) || parsedQty <= 0) {
      setSalesPlanFormError("Количество должно быть больше 0.");
      return;
    }

    if (salesPlanFormMode === "create" && !salesPlanFormNomenclatureId) {
      setSalesPlanFormError("Выберите номенклатуру.");
      return;
    }

    setIsSalesPlanSaving(true);
    setSalesPlanFormError("");
    try {
      if (salesPlanFormMode === "create") {
        await createSalesPlanItem({
          plan_date: monthToApiDate(planMonth),
          nomenclature_id: Number(salesPlanFormNomenclatureId),
          plan_qty: normalizedQtyText,
        });
      } else if (salesPlanFormItem?.sales_plan_id) {
        await updateSalesPlanItem(salesPlanFormItem.sales_plan_id, {
          plan_qty: normalizedQtyText,
        });
      }

      await reloadSalesPlan();
      setIsSalesPlanFormOpen(false);
      setSalesPlanFormItem(null);
      setSalesPlanFormQty("");
      setSalesPlanFormNomenclatureId("");
      setSalesPlanFormError("");
    } catch (error) {
      if (error?.status === 409) {
        setSalesPlanFormError("Позиция уже есть в плане продаж за выбранный период.");
      } else {
        setSalesPlanFormError(error.message || "Не удалось сохранить строку плана продаж.");
      }
    } finally {
      setIsSalesPlanSaving(false);
    }
  };

  const handleAskDeleteSalesPlan = (item) => {
    setSalesPlanDeleteError("");
    setSalesPlanDeleteCandidate(item);
  };

  const handleConfirmDeleteSalesPlan = async () => {
    if (!salesPlanDeleteCandidate?.sales_plan_id) {
      return;
    }

    const deletingId = salesPlanDeleteCandidate.sales_plan_id;
    setDeletingSalesPlanId(deletingId);
    setSalesPlanDeleteError("");
    try {
      await deleteSalesPlanItem(deletingId);
      await reloadSalesPlan();
      setSalesPlanDeleteCandidate(null);
    } catch (error) {
      setSalesPlanDeleteError(error.message || "Не удалось удалить строку плана продаж.");
    } finally {
      setDeletingSalesPlanId(null);
    }
  };

  const handleOpenCreateInventoryForm = async () => {
    if (!balanceDate) {
      setInventoryFormError("Сначала загрузите или выберите дату остатков.");
      return;
    }

    setInventoryFormMode("create");
    setInventoryFormItem(null);
    setInventoryFormError("");
    setInventoryFormQty("");
    setInventoryFormNomenclatureId("");
    setIsInventoryFormOpen(true);
    await loadNomenclatureItems();
  };

  const handleOpenEditInventoryForm = (item) => {
    setInventoryFormMode("edit");
    setInventoryFormItem(item);
    setInventoryFormError("");
    setInventoryFormNomenclatureId(String(item.nomenclature_id));
    setInventoryFormQty(String(item.available_qty ?? ""));
    setIsInventoryFormOpen(true);
  };

  const handleCloseInventoryForm = () => {
    if (isInventorySaving) {
      return;
    }
    setIsInventoryFormOpen(false);
    setInventoryFormError("");
  };

  const handleSaveInventoryForm = async () => {
    if (!balanceDate) {
      setInventoryFormError("Сначала загрузите или выберите дату остатков.");
      return;
    }

    const normalizedQtyText = String(inventoryFormQty ?? "").replace(",", ".").trim();
    const parsedQty = Number(normalizedQtyText);
    if (!normalizedQtyText || !Number.isFinite(parsedQty) || parsedQty < 0) {
      setInventoryFormError("Доступный остаток должен быть больше или равен 0.");
      return;
    }

    if (inventoryFormMode === "create" && !inventoryFormNomenclatureId) {
      setInventoryFormError("Выберите номенклатуру.");
      return;
    }

    setIsInventorySaving(true);
    setInventoryFormError("");
    try {
      if (inventoryFormMode === "create") {
        await createInventoryBalanceItem({
          as_of_date: balanceDate,
          nomenclature_id: Number(inventoryFormNomenclatureId),
          available_qty: normalizedQtyText,
        });
      } else if (inventoryFormItem?.balance_id) {
        await updateInventoryBalanceItem(inventoryFormItem.balance_id, {
          available_qty: normalizedQtyText,
        });
      }

      await reloadInventoryBalanceDates();
      await reloadInventoryBalance();
      setIsInventoryFormOpen(false);
      setInventoryFormItem(null);
      setInventoryFormQty("");
      setInventoryFormNomenclatureId("");
      setInventoryFormError("");
    } catch (error) {
      if (error?.status === 409) {
        setInventoryFormError("Позиция уже есть в остатках на выбранную дату.");
      } else {
        setInventoryFormError(error.message || "Не удалось сохранить строку остатков.");
      }
    } finally {
      setIsInventorySaving(false);
    }
  };

  const handleAskDeleteInventory = (item) => {
    setInventoryDeleteError("");
    setInventoryDeleteCandidate(item);
  };

  const handleConfirmDeleteInventory = async () => {
    if (!inventoryDeleteCandidate?.balance_id) {
      return;
    }

    const deletingId = inventoryDeleteCandidate.balance_id;
    setDeletingInventoryId(deletingId);
    setInventoryDeleteError("");
    try {
      await deleteInventoryBalanceItem(deletingId);
      await reloadInventoryBalanceDates();
      await reloadInventoryBalance();
      setInventoryDeleteCandidate(null);
    } catch (error) {
      setInventoryDeleteError(error.message || "Не удалось удалить строку остатков.");
    } finally {
      setDeletingInventoryId(null);
    }
  };

  const handleOpenCreateSafetyStockForm = async () => {
    setSafetyStockFormMode("create");
    setSafetyStockFormItem(null);
    setSafetyStockFormError("");
    setSafetyStockFormQty("");
    setSafetyStockFormNomenclatureId("");
    setIsSafetyStockFormOpen(true);
    await loadNomenclatureItems();
  };

  const handleOpenEditSafetyStockForm = (item) => {
    setSafetyStockFormMode("edit");
    setSafetyStockFormItem(item);
    setSafetyStockFormError("");
    setSafetyStockFormNomenclatureId(String(item.nomenclature_id));
    setSafetyStockFormQty(String(item.stock_qty ?? ""));
    setIsSafetyStockFormOpen(true);
  };

  const handleCloseSafetyStockForm = () => {
    if (isSafetyStockSaving) {
      return;
    }
    setIsSafetyStockFormOpen(false);
    setSafetyStockFormError("");
  };

  const handleSaveSafetyStockForm = async () => {
    const normalizedQtyText = String(safetyStockFormQty ?? "").replace(",", ".").trim();
    const parsedQty = Number(normalizedQtyText);
    if (!normalizedQtyText || !Number.isFinite(parsedQty) || parsedQty < 0) {
      setSafetyStockFormError("Страховой запас должен быть больше или равен 0.");
      return;
    }

    if (safetyStockFormMode === "create" && !safetyStockFormNomenclatureId) {
      setSafetyStockFormError("Выберите номенклатуру.");
      return;
    }

    setIsSafetyStockSaving(true);
    setSafetyStockFormError("");
    try {
      if (safetyStockFormMode === "create") {
        await createSafetyStockItem({
          nomenclature_id: Number(safetyStockFormNomenclatureId),
          stock_qty: normalizedQtyText,
        });
      } else if (safetyStockFormItem?.safety_stock_id) {
        await updateSafetyStockItem(safetyStockFormItem.safety_stock_id, {
          stock_qty: normalizedQtyText,
        });
      }

      await reloadSafetyStock();
      setIsSafetyStockFormOpen(false);
      setSafetyStockFormItem(null);
      setSafetyStockFormQty("");
      setSafetyStockFormNomenclatureId("");
      setSafetyStockFormError("");
    } catch (error) {
      if (error?.status === 409) {
        setSafetyStockFormError("Позиция уже есть в страховом запасе.");
      } else {
        setSafetyStockFormError(error.message || "Не удалось сохранить строку страхового запаса.");
      }
    } finally {
      setIsSafetyStockSaving(false);
    }
  };

  const handleAskDeleteSafetyStock = (item) => {
    setSafetyStockDeleteError("");
    setSafetyStockDeleteCandidate(item);
  };

  const handleConfirmDeleteSafetyStock = async () => {
    if (!safetyStockDeleteCandidate?.safety_stock_id) {
      return;
    }

    const deletingId = safetyStockDeleteCandidate.safety_stock_id;
    setDeletingSafetyStockId(deletingId);
    setSafetyStockDeleteError("");
    try {
      await deleteSafetyStockItem(deletingId);
      await reloadSafetyStock();
      setSafetyStockDeleteCandidate(null);
    } catch (error) {
      setSafetyStockDeleteError(error.message || "Не удалось удалить строку страхового запаса.");
    } finally {
      setDeletingSafetyStockId(null);
    }
  };

  const currentSourceDataset = useMemo(() => {
    if (activeSourceTab === IMPORT_CONTEXT_INVENTORY_BALANCE) {
      return {
        context: IMPORT_CONTEXT_INVENTORY_BALANCE,
        title: "Остатки",
        subtitle: "Снимок доступных остатков на выбранную дату.",
      dateLabel: "Дата остатков",
      dateInputType: "select_dates",
        dateValue: balanceDate,
        onDateChange: setBalanceDate,
        dateOptions: inventoryBalanceDates,
        isDateOptionsLoading: isInventoryDatesLoading,
        dateOptionsError: inventoryDatesError,
        searchValue: inventorySearch,
        onSearchChange: setInventorySearch,
        isLoading: isInventoryLoading,
        error: inventoryError,
        items: inventoryItems,
        filteredItems: filteredInventoryItems,
        qtyKey: "available_qty",
        qtyHeader: "Доступный остаток",
        emptyMessage:
          inventoryBalanceDates.length === 0
            ? "Остатки ещё не загружены."
            : "За выбранную дату остатки не загружены.",
        rowKey: (item) => item.balance_id,
        reload: reloadInventoryBalance,
        selectionDateText: balanceDate ? `Дата остатков: ${balanceDate}` : "Дата остатков: —",
        latestDateText: inventoryBalanceDates[0] || "—",
        isLatestDateSelected: Boolean(balanceDate && inventoryBalanceDates[0] === balanceDate),
        hints: ["По умолчанию используется последняя загруженная дата остатков."],
        checks: [
          "Проверьте, что дата остатка соответствует дате среза склада.",
          "Убедитесь, что в таблице нет пустого кода и наименования.",
        ],
      };
    }

    if (activeSourceTab === IMPORT_CONTEXT_SAFETY_STOCK) {
      return {
        context: IMPORT_CONTEXT_SAFETY_STOCK,
        title: "Страховой запас",
        subtitle: "Минимальный запас, учитываемый при расчёте потребности.",
        dateLabel: null,
        dateInputType: null,
        dateValue: "",
        onDateChange: () => {},
        dateOptions: [],
        isDateOptionsLoading: false,
        dateOptionsError: "",
        searchValue: safetyStockSearch,
        onSearchChange: setSafetyStockSearch,
        isLoading: isSafetyStockLoading,
        error: safetyStockError,
        items: safetyStockItems,
        filteredItems: filteredSafetyStockItems,
        qtyKey: "stock_qty",
        qtyHeader: "Страховой запас",
        emptyMessage: "Страховой запас пока не загружен.",
        rowKey: (item) => item.safety_stock_id,
        reload: reloadSafetyStock,
        selectionDateText: "Без даты",
        hints: ["Если позиции нет в страховом запасе, норматив считается нулевым."],
        checks: [
          "Количество страхового запаса должно быть неотрицательным.",
          "Проверьте, что единицы измерения совпадают с номенклатурой.",
        ],
      };
    }

    return {
      context: IMPORT_CONTEXT_SALES_PLAN,
      title: "План продаж",
      subtitle: "Плановые объёмы продаж за выбранный месяц.",
      dateLabel: "Период планирования",
      dateInputType: "month",
      dateValue: planMonth,
      onDateChange: setPlanMonth,
      dateOptions: [],
      isDateOptionsLoading: false,
      dateOptionsError: "",
      searchValue: salesPlanSearch,
      onSearchChange: setSalesPlanSearch,
      isLoading: isSalesPlanLoading,
      error: salesPlanError,
      items: salesPlanItems,
      filteredItems: filteredSalesPlanItems,
      qtyKey: "plan_qty",
        qtyHeader: "Количество",
      emptyMessage: "За выбранный период план продаж не загружен.",
        rowKey: (item) => item.sales_plan_id,
        reload: reloadSalesPlan,
      selectionDateText: `Период планирования: ${formatMonthLabel(planMonth)}`,
      hints: ["План продаж задаётся на месяц. Импорт обновляет существующие позиции."],
      checks: [
        "Убедитесь, что количество указано в единице номенклатуры.",
        "Проверьте, что периоды в импорте соответствуют выбранному фильтру.",
      ],
    };
  }, [
    activeSourceTab,
    balanceDate,
    inventoryBalanceDates,
    inventoryDatesError,
    filteredInventoryItems,
    filteredSafetyStockItems,
    filteredSalesPlanItems,
    inventoryError,
    inventoryItems,
    inventorySearch,
    isInventoryDatesLoading,
    isInventoryLoading,
    isSafetyStockLoading,
    isSalesPlanLoading,
    planMonth,
    reloadInventoryBalance,
    reloadSafetyStock,
    reloadSalesPlan,
    safetyStockError,
    safetyStockItems,
    safetyStockSearch,
    salesPlanError,
    salesPlanItems,
    salesPlanSearch,
  ]);

  const showSearchEmpty =
    !currentSourceDataset.isLoading &&
    !currentSourceDataset.error &&
    currentSourceDataset.items.length > 0 &&
    currentSourceDataset.filteredItems.length === 0;
  const showNoData =
    !currentSourceDataset.isLoading &&
    !currentSourceDataset.error &&
    currentSourceDataset.items.length === 0;
  const showImportErrorInContext =
    importError && !isImportOpen && importErrorContext === currentSourceDataset.context;

  return (
    <section className="space-y-6">
      <header className="glass-panel p-4 sm:p-5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
          Потребность
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
          Подготовьте входные данные, запустите расчёт потребности и проверьте результат.
        </p>
      </header>

      <section className="glass-panel p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {MODULE_TABS.map((tab) => {
            const isActive = activeModuleTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveModuleTab(tab.id)}
                className={[
                  TAB_BUTTON_BASE_CLASS,
                  isActive
                    ? "border-cyan-300/35 bg-cyan-400/[0.18] text-cyan-50 shadow-cyanGlow"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/20 hover:bg-cyan-400/[0.08] hover:text-cyan-50",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {activeModuleTab === MODULE_TAB_SOURCE_DATA ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-3">
              {summaryCards.map((card) => {
                const isActive = activeSourceTab === card.id;
                const CardIcon = card.icon;
                const iconClassName =
                  card.iconClassName || "border-cyan-300/24 bg-cyan-400/[0.08] text-cyan-100";
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setActiveSourceTab(card.id)}
                    className={[
                      "glass-panel p-4 text-left transition",
                      isActive
                        ? "border-cyan-300/35 shadow-cyanGlow"
                        : "hover:border-cyan-300/20 hover:bg-cyan-400/[0.04]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={[
                            "inline-flex h-8 w-8 items-center justify-center rounded-none border",
                            iconClassName,
                          ].join(" ")}
                        >
                          <CardIcon className="h-4 w-4" />
                        </span>
                        <div className="text-sm font-semibold text-slate-100">{card.title}</div>
                      </div>
                      <span className={["inline-flex items-center gap-1.5 px-1.5 py-1 text-xs", card.status.className].join(" ")}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
                        {card.status.label}
                      </span>
                    </div>
                    <div className="mt-4 space-y-1 text-sm text-slate-300">
                      <div>Позиций: {card.rowsCount}</div>
                      <div className="text-xs text-slate-500">{card.dateText}</div>
                      {card.dateBadgeText ? <div className="text-xs text-cyan-200/70">{card.dateBadgeText}</div> : null}
                    </div>
                  </button>
                );
              })}
            </section>

            <section className="glass-panel p-4 sm:p-5">
              <div className="space-y-4">
                <div className="w-full">
                  <h2 className="text-xl font-semibold tracking-tight text-slate-50">
                    {currentSourceDataset.title}
                  </h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{currentSourceDataset.subtitle}</p>
                </div>

                <div
                  className={[
                    "grid w-full gap-3 sm:grid-cols-2",
                    currentSourceDataset.dateLabel
                      ? "xl:grid-cols-[minmax(220px,260px)_minmax(360px,1fr)_auto_auto]"
                      : "xl:grid-cols-[minmax(360px,1fr)_auto_auto]",
                  ].join(" ")}
                >
                  {currentSourceDataset.dateLabel ? (
                    <div>
                      <label
                        htmlFor="demand-date-filter"
                        className="mb-2 block text-xs tracking-[0.08em] text-slate-500"
                      >
                        {currentSourceDataset.dateLabel}
                      </label>
                      {currentSourceDataset.dateInputType === "select_dates" ? (
                        <select
                          id="demand-date-filter"
                          value={currentSourceDataset.dateValue}
                          onChange={(event) => currentSourceDataset.onDateChange(event.target.value)}
                          disabled={
                            currentSourceDataset.isDateOptionsLoading ||
                            currentSourceDataset.dateOptions.length === 0
                          }
                          className="h-10 w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {currentSourceDataset.dateOptions.length > 0 ? (
                            currentSourceDataset.dateOptions.map((optionDate, index) => (
                              <option key={optionDate} value={optionDate}>
                                {index === 0 ? `${optionDate} — последняя загрузка` : optionDate}
                              </option>
                            ))
                          ) : (
                            <option value="">Остатки ещё не загружены.</option>
                          )}
                        </select>
                      ) : (
                        <input
                          id="demand-date-filter"
                          type={currentSourceDataset.dateInputType || "date"}
                          value={currentSourceDataset.dateValue}
                          onChange={(event) => currentSourceDataset.onDateChange(event.target.value)}
                          className="h-10 w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                        />
                      )}
                    </div>
                  ) : null}

                  <div>
                    <label
                      htmlFor="demand-search-filter"
                      className="mb-2 block text-xs tracking-[0.08em] text-slate-500"
                    >
                      Поиск
                    </label>
                    <div className="flex h-10 items-center border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3">
                      <Search className="h-4 w-4 text-slate-400" />
                      <input
                        id="demand-search-filter"
                        type="search"
                        value={currentSourceDataset.searchValue}
                        onChange={(event) => currentSourceDataset.onSearchChange(event.target.value)}
                        placeholder="Поиск по коду или наименованию..."
                        className="w-full bg-transparent pl-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-end gap-2">
                    {activeSourceTab === IMPORT_CONTEXT_SALES_PLAN ? (
                      <button
                        type="button"
                        onClick={handleOpenCreateSalesPlanForm}
                        disabled={isSalesPlanSaving || deletingSalesPlanId !== null}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Plus className="h-4 w-4" />
                        Добавить позицию
                      </button>
                    ) : null}
                    {activeSourceTab === IMPORT_CONTEXT_INVENTORY_BALANCE ? (
                      <button
                        type="button"
                        onClick={handleOpenCreateInventoryForm}
                        disabled={!balanceDate || isInventorySaving || deletingInventoryId !== null}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Plus className="h-4 w-4" />
                        Добавить позицию
                      </button>
                    ) : null}
                    {activeSourceTab === IMPORT_CONTEXT_SAFETY_STOCK ? (
                      <button
                        type="button"
                        onClick={handleOpenCreateSafetyStockForm}
                        disabled={isSafetyStockSaving || deletingSafetyStockId !== null}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Plus className="h-4 w-4" />
                        Добавить позицию
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={currentSourceDataset.reload}
                      disabled={currentSourceDataset.isLoading}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60 xl:w-auto"
                    >
                      <RefreshCw
                        className={["h-4 w-4", currentSourceDataset.isLoading ? "animate-spin" : ""].join(
                          " ",
                        )}
                      />
                      Обновить
                    </button>
                  </div>
                </div>
              </div>

              {currentSourceDataset.error ? (
                <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{currentSourceDataset.error}</span>
                </div>
              ) : null}
              {currentSourceDataset.dateOptionsError ? (
                <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{currentSourceDataset.dateOptionsError}</span>
                </div>
              ) : null}

              <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))]">
                {currentSourceDataset.isLoading ? (
                  <div className="px-4 py-4 text-sm text-slate-300">Загружаем данные...</div>
                ) : showNoData ? (
                  <div className="px-4 py-4 text-sm text-slate-400">{currentSourceDataset.emptyMessage}</div>
                ) : showSearchEmpty ? (
                  <div className="px-4 py-4 text-sm text-slate-400">Поиск не нашёл подходящих строк.</div>
                ) : (
                  <div className="max-h-[520px] overflow-auto">
                    <table className="min-w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))]">
                        <tr className="text-left">
                          <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                            Код
                          </th>
                          <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                            Наименование
                          </th>
                          <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 text-right">
                            {currentSourceDataset.qtyHeader}
                          </th>
                          <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                            Ед.
                          </th>
                          {activeSourceTab === IMPORT_CONTEXT_SALES_PLAN ||
                          activeSourceTab === IMPORT_CONTEXT_INVENTORY_BALANCE ||
                          activeSourceTab === IMPORT_CONTEXT_SAFETY_STOCK ? (
                            <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                              Действия
                            </th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {currentSourceDataset.filteredItems.map((item) => (
                          <tr
                            key={currentSourceDataset.rowKey(item)}
                            className="border-t border-white/[0.05] transition hover:bg-cyan-300/[0.03]"
                          >
                            <td className="px-3 py-2.5 text-sm font-medium text-slate-100">{item.nomenclature_code || "—"}</td>
                            <td className="px-3 py-2.5 text-sm text-slate-300">{item.nomenclature_name || "—"}</td>
                            <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-200">
                              {formatQty(item[currentSourceDataset.qtyKey])}
                            </td>
                            <td className="px-3 py-2.5 text-sm text-slate-300">{item.unit_of_measure || "—"}</td>
                            {activeSourceTab === IMPORT_CONTEXT_SALES_PLAN ||
                            activeSourceTab === IMPORT_CONTEXT_INVENTORY_BALANCE ||
                            activeSourceTab === IMPORT_CONTEXT_SAFETY_STOCK ? (
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                  {activeSourceTab === IMPORT_CONTEXT_SALES_PLAN ? (
                                    <>
                                      <IconActionButton
                                        label="Редактировать"
                                        onClick={() => handleOpenEditSalesPlanForm(item)}
                                        disabled={isSalesPlanSaving || deletingSalesPlanId === item.sales_plan_id}
                                      >
                                        <PencilLine className="h-3.5 w-3.5" />
                                      </IconActionButton>
                                      <IconActionButton
                                        label="Удалить"
                                        onClick={() => handleAskDeleteSalesPlan(item)}
                                        disabled={isSalesPlanSaving || deletingSalesPlanId === item.sales_plan_id}
                                        tone="danger"
                                      >
                                        {deletingSalesPlanId === item.sales_plan_id ? (
                                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                      </IconActionButton>
                                    </>
                                  ) : (
                                    activeSourceTab === IMPORT_CONTEXT_INVENTORY_BALANCE ? (
                                      <>
                                        <IconActionButton
                                          label="Редактировать"
                                          onClick={() => handleOpenEditInventoryForm(item)}
                                          disabled={isInventorySaving || deletingInventoryId === item.balance_id}
                                        >
                                          <PencilLine className="h-3.5 w-3.5" />
                                        </IconActionButton>
                                        <IconActionButton
                                          label="Удалить"
                                          onClick={() => handleAskDeleteInventory(item)}
                                          disabled={isInventorySaving || deletingInventoryId === item.balance_id}
                                          tone="danger"
                                        >
                                          {deletingInventoryId === item.balance_id ? (
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                          )}
                                        </IconActionButton>
                                      </>
                                    ) : (
                                      <>
                                        <IconActionButton
                                          label="Редактировать"
                                          onClick={() => handleOpenEditSafetyStockForm(item)}
                                          disabled={isSafetyStockSaving || deletingSafetyStockId === item.safety_stock_id}
                                        >
                                          <PencilLine className="h-3.5 w-3.5" />
                                        </IconActionButton>
                                        <IconActionButton
                                          label="Удалить"
                                          onClick={() => handleAskDeleteSafetyStock(item)}
                                          disabled={isSafetyStockSaving || deletingSafetyStockId === item.safety_stock_id}
                                          tone="danger"
                                        >
                                          {deletingSafetyStockId === item.safety_stock_id ? (
                                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <Trash2 className="h-3.5 w-3.5" />
                                          )}
                                        </IconActionButton>
                                      </>
                                    )
                                  )}
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-cyan-300/14 bg-cyan-400/[0.06]">
                          <td className="px-3 py-2 text-xs tracking-[0.08em] text-slate-300">Итого</td>
                          <td className="px-3 py-2 text-sm text-slate-300">Позиций: {currentSourceDataset.filteredItems.length}</td>
                          <td className="px-3 py-2 text-sm text-slate-500"></td>
                          <td className="px-3 py-2 text-sm text-slate-500"></td>
                          {activeSourceTab === IMPORT_CONTEXT_SALES_PLAN ||
                          activeSourceTab === IMPORT_CONTEXT_INVENTORY_BALANCE ||
                          activeSourceTab === IMPORT_CONTEXT_SAFETY_STOCK ? (
                            <td className="px-3 py-2 text-sm text-slate-500"></td>
                          ) : null}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>

          {isImportOpen ? (
            renderImportPanel()
          ) : activeSourceTab === IMPORT_CONTEXT_SALES_PLAN && isSalesPlanFormOpen ? (
            <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
              <div className="panel-title">
                {salesPlanFormMode === "create" ? "Добавление" : "Редактирование"}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
                {salesPlanFormMode === "create" ? "Добавить позицию плана" : "Редактировать позицию плана"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {salesPlanFormMode === "create"
                  ? "Заполните данные и сохраните новую строку плана продаж."
                  : "Измените количество и сохраните корректировку."}
              </p>

              <div className="panel-divider mt-5" />

              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">
                    Период планирования
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={formatMonthLabel(planMonth)}
                    className="w-full rounded-none border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                  />
                </div>

                {salesPlanFormMode === "create" ? (
                  <NomenclatureSearchSelect
                    label="Номенклатура"
                    items={nomenclatureItems}
                    value={salesPlanFormNomenclatureId}
                    onChange={(value) => setSalesPlanFormNomenclatureId(String(value))}
                    disabled={isSalesPlanSaving || isNomenclatureLoading}
                  />
                ) : (
                  <div className="space-y-3 rounded-none border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                    <div className="text-slate-200">Код: {salesPlanFormItem?.nomenclature_code}</div>
                    <div className="text-slate-200">Наименование: {salesPlanFormItem?.nomenclature_name}</div>
                    <div className="text-slate-300">Ед.: {salesPlanFormItem?.unit_of_measure}</div>
                  </div>
                )}

                <div>
                  <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Количество</div>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={salesPlanFormQty}
                    onChange={(event) => setSalesPlanFormQty(event.target.value)}
                    className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                  />
                </div>

                {salesPlanFormError ? (
                  <div className="flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{salesPlanFormError}</span>
                  </div>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseSalesPlanForm}
                    disabled={isSalesPlanSaving}
                    className="inline-flex items-center rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSalesPlanForm}
                    disabled={isSalesPlanSaving}
                    className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSalesPlanSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    {isSalesPlanSaving ? "Сохраняем..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </aside>
          ) : activeSourceTab === IMPORT_CONTEXT_INVENTORY_BALANCE && isInventoryFormOpen ? (
            <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
              <div className="panel-title">
                {inventoryFormMode === "create" ? "Добавление" : "Редактирование"}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
                {inventoryFormMode === "create" ? "Добавить позицию остатков" : "Редактировать остаток"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {inventoryFormMode === "create"
                  ? "Заполните данные и сохраните новую строку снимка остатков."
                  : "Измените доступный остаток и сохраните корректировку."}
              </p>

              <div className="panel-divider mt-5" />

              <div className="mt-5 space-y-4">
                <div>
                  <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Дата остатков</div>
                  <input
                    type="text"
                    readOnly
                    value={balanceDate || "—"}
                    className="w-full rounded-none border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                  />
                </div>

                {inventoryFormMode === "create" ? (
                  <NomenclatureSearchSelect
                    label="Номенклатура"
                    items={nomenclatureItems}
                    value={inventoryFormNomenclatureId}
                    onChange={(value) => setInventoryFormNomenclatureId(String(value))}
                    disabled={isInventorySaving || isNomenclatureLoading}
                  />
                ) : (
                  <div className="space-y-3 rounded-none border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                    <div className="text-slate-200">Код: {inventoryFormItem?.nomenclature_code}</div>
                    <div className="text-slate-200">Наименование: {inventoryFormItem?.nomenclature_name}</div>
                    <div className="text-slate-300">Ед.: {inventoryFormItem?.unit_of_measure}</div>
                  </div>
                )}

                <div>
                  <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Доступный остаток</div>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={inventoryFormQty}
                    onChange={(event) => setInventoryFormQty(event.target.value)}
                    className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                  />
                </div>

                {inventoryFormError ? (
                  <div className="flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{inventoryFormError}</span>
                  </div>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseInventoryForm}
                    disabled={isInventorySaving}
                    className="inline-flex items-center rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveInventoryForm}
                    disabled={isInventorySaving}
                    className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isInventorySaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    {isInventorySaving ? "Сохраняем..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </aside>
          ) : activeSourceTab === IMPORT_CONTEXT_SAFETY_STOCK && isSafetyStockFormOpen ? (
            <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
              <div className="panel-title">
                {safetyStockFormMode === "create" ? "Добавление" : "Редактирование"}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
                {safetyStockFormMode === "create" ? "Добавить страховой запас" : "Редактировать страховой запас"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {safetyStockFormMode === "create"
                  ? "Заполните данные и сохраните новую строку страхового запаса."
                  : "Измените количество страхового запаса и сохраните корректировку."}
              </p>

              <div className="panel-divider mt-5" />

              <div className="mt-5 space-y-4">
                {safetyStockFormMode === "create" ? (
                  <NomenclatureSearchSelect
                    label="Номенклатура"
                    items={nomenclatureItems}
                    value={safetyStockFormNomenclatureId}
                    onChange={(value) => setSafetyStockFormNomenclatureId(String(value))}
                    disabled={isSafetyStockSaving || isNomenclatureLoading}
                  />
                ) : (
                  <div className="space-y-3 rounded-none border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                    <div className="text-slate-200">Код: {safetyStockFormItem?.nomenclature_code}</div>
                    <div className="text-slate-200">Наименование: {safetyStockFormItem?.nomenclature_name}</div>
                    <div className="text-slate-300">Ед.: {safetyStockFormItem?.unit_of_measure}</div>
                  </div>
                )}

                <div>
                  <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Страховой запас</div>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={safetyStockFormQty}
                    onChange={(event) => setSafetyStockFormQty(event.target.value)}
                    className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                  />
                </div>

                {safetyStockFormError ? (
                  <div className="flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{safetyStockFormError}</span>
                  </div>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseSafetyStockForm}
                    disabled={isSafetyStockSaving}
                    className="inline-flex items-center rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSafetyStockForm}
                    disabled={isSafetyStockSaving}
                    className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSafetyStockSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    {isSafetyStockSaving ? "Сохраняем..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </aside>
          ) : (
            <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
              <div className="panel-title">Контекст</div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">
                {currentSourceDataset.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Управляйте импортом и проверяйте текущую выборку перед расчётом потребности.
              </p>

              <div className="panel-divider mt-5" />

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenImportPanel(currentSourceDataset.context)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
                >
                  <Upload className="h-4 w-4" />
                  Импорт Excel
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate(currentSourceDataset.context)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]"
                >
                  <Download className="h-4 w-4" />
                  Скачать шаблон
                </button>
              </div>

              {showImportErrorInContext ? (
                <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              ) : null}

              <div className="mt-6 space-y-4">
                <div className="rounded-none border border-white/8 bg-white/[0.025] px-4 py-4">
                  <div className="flex items-center gap-2 text-slate-200">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span className="text-sm font-medium">Текущая выборка</span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-300">
                    {activeSourceTab === IMPORT_CONTEXT_INVENTORY_BALANCE ? (
                      <>
                        <div>Источник: Остатки</div>
                        <div>{currentSourceDataset.selectionDateText}</div>
                        <div>Последняя загрузка: {currentSourceDataset.latestDateText}</div>
                        <div>Строк: {currentSourceDataset.filteredItems.length}</div>
                      </>
                    ) : (
                      <>
                        <div>{currentSourceDataset.selectionDateText}</div>
                        <div>Позиций: {currentSourceDataset.items.length}</div>
                        <div>Строк после поиска: {currentSourceDataset.filteredItems.length}</div>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-none border border-white/8 bg-white/[0.025] px-4 py-3">
                  <div className="text-sm font-medium text-slate-100">Проверка данных</div>
                  <div
                    className={[
                      "mt-2 flex items-start gap-2 text-sm leading-6",
                      currentSourceDataset.error ? "text-rose-100" : "text-emerald-100",
                    ].join(" ")}
                  >
                    {currentSourceDataset.error ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {currentSourceDataset.error
                        ? "Есть ошибка загрузки данных."
                        : currentSourceDataset.isLoading
                          ? "Данные обновляются."
                          : currentSourceDataset.items.length > 0
                            ? "Набор данных загружен, можно переходить к расчёту."
                            : "Набор данных не загружен."}
                    </span>
                  </div>
                </div>

                <div className="rounded-none border border-white/8 bg-white/[0.025] px-4 py-4">
                  <div className="text-sm font-medium text-slate-100">Подсказка</div>
                  <div className="mt-2 space-y-1 text-sm leading-6 text-slate-400">
                    {currentSourceDataset.hints.map((hint) => (
                      <p key={hint}>{hint}</p>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
          )}
        </section>
      ) : null}

      <V2ConfirmDialog
        isOpen={Boolean(salesPlanDeleteCandidate)}
        title="Удалить позицию из плана продаж?"
        message={
          salesPlanDeleteCandidate
            ? `Позиция ${salesPlanDeleteCandidate.nomenclature_code} — ${salesPlanDeleteCandidate.nomenclature_name} будет удалена из плана продаж за выбранный период. Номенклатура в справочнике не удаляется.`
            : ""
        }
        confirmText={deletingSalesPlanId ? "Удаляем..." : "Удалить"}
        cancelText="Отмена"
        isConfirmDisabled={Boolean(deletingSalesPlanId)}
        isCancelDisabled={Boolean(deletingSalesPlanId)}
        onCancel={() => {
          if (!deletingSalesPlanId) {
            setSalesPlanDeleteCandidate(null);
          }
        }}
        onConfirm={handleConfirmDeleteSalesPlan}
      />

      <V2ConfirmDialog
        isOpen={Boolean(inventoryDeleteCandidate)}
        title="Удалить позицию из остатков?"
        message={
          inventoryDeleteCandidate
            ? `Позиция ${inventoryDeleteCandidate.nomenclature_code} — ${inventoryDeleteCandidate.nomenclature_name} будет удалена из снимка остатков на ${inventoryDeleteCandidate.as_of_date}. Номенклатура в справочнике не удаляется.`
            : ""
        }
        confirmText={deletingInventoryId ? "Удаляем..." : "Удалить"}
        cancelText="Отмена"
        isConfirmDisabled={Boolean(deletingInventoryId)}
        isCancelDisabled={Boolean(deletingInventoryId)}
        onCancel={() => {
          if (!deletingInventoryId) {
            setInventoryDeleteCandidate(null);
          }
        }}
        onConfirm={handleConfirmDeleteInventory}
      />

      <V2ConfirmDialog
        isOpen={Boolean(safetyStockDeleteCandidate)}
        title="Удалить позицию страхового запаса?"
        message={
          safetyStockDeleteCandidate
            ? `Позиция ${safetyStockDeleteCandidate.nomenclature_code} — ${safetyStockDeleteCandidate.nomenclature_name} будет удалена из страхового запаса. Номенклатура в справочнике не удаляется.`
            : ""
        }
        confirmText={deletingSafetyStockId ? "Удаляем..." : "Удалить"}
        cancelText="Отмена"
        isConfirmDisabled={Boolean(deletingSafetyStockId)}
        isCancelDisabled={Boolean(deletingSafetyStockId)}
        onCancel={() => {
          if (!deletingSafetyStockId) {
            setSafetyStockDeleteCandidate(null);
          }
        }}
        onConfirm={handleConfirmDeleteSafetyStock}
      />

      {salesPlanDeleteError ? (
        <div className="glass-panel border-rose-300/30 bg-rose-500/[0.1] p-4 text-sm text-rose-100">
          {salesPlanDeleteError}
        </div>
      ) : null}
      {inventoryDeleteError ? (
        <div className="glass-panel border-rose-300/30 bg-rose-500/[0.1] p-4 text-sm text-rose-100">
          {inventoryDeleteError}
        </div>
      ) : null}
      {safetyStockDeleteError ? (
        <div className="glass-panel border-rose-300/30 bg-rose-500/[0.1] p-4 text-sm text-rose-100">
          {safetyStockDeleteError}
        </div>
      ) : null}

      {activeModuleTab === MODULE_TAB_CALCULATE ? (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-4">
            <section className="glass-panel p-5 sm:p-6">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-50">Расчёт потребности</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                Расчёт выполняется на выбранный месяц планирования с учётом плана продаж, страхового запаса и выбранного снимка остатков.
              </p>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="w-full max-w-[320px]">
                  <label className="mb-2 block text-xs tracking-[0.08em] text-slate-500">Период планирования</label>
                  <input
                    type="month"
                    value={planMonth}
                    onChange={(event) => setPlanMonth(event.target.value)}
                    className="h-11 w-full rounded-none border border-cyan-300/16 bg-[rgba(8,24,38,0.85)] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/55 focus:ring-2 focus:ring-cyan-400/15"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCalculateDemand}
                  disabled={isDemandCalculating}
                  className="inline-flex h-11 items-center gap-2 rounded-none border border-cyan-300/38 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/[0.2] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={["h-4 w-4", isDemandCalculating ? "animate-spin" : ""].join(" ")} />
                  {isDemandCalculating ? "Рассчитываем..." : "Рассчитать потребность"}
                </button>
              </div>

              {!planMonth || !balanceDate ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setActiveModuleTab(MODULE_TAB_SOURCE_DATA)}
                    className="inline-flex items-center rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]"
                  >
                    Перейти к исходным данным
                  </button>
                </div>
              ) : null}
            </section>

            {demandCalculateError ? (
              <div className="glass-panel border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">{demandCalculateError}</div>
            ) : null}

            {!demandResult ? (
              <section className="glass-panel px-4 py-5 text-sm text-slate-400">
                Запустите расчёт, чтобы увидеть потребность к выпуску.
              </section>
            ) : (
              <>
                <section className="glass-panel p-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <h3 className="text-xl font-semibold text-slate-50">Верхний спрос</h3>
                    <div className="text-sm text-slate-400">Позиций: <span className="font-medium tabular-nums text-slate-100">{demandTopLevelItems.length}</span></div>
                  </div>
                  <div className="mt-4 max-h-[420px] overflow-auto border border-cyan-300/10">
                    <table className="min-w-full text-left text-sm text-slate-200">
                      <thead className="sticky top-0 bg-[rgba(8,22,34,0.95)] text-[11px] uppercase tracking-[0.08em] text-slate-500"><tr><th className="px-3 py-2">Код</th><th className="px-3 py-2">Наименование</th><th className="px-3 py-2 text-right">План продаж</th><th className="px-3 py-2 text-right">Страховой запас</th><th className="px-3 py-2 text-right">Остаток</th><th className="px-3 py-2 text-right">Валовая потребность</th><th className="px-3 py-2 text-right">Потребность к выпуску</th></tr></thead>
                      <tbody>
                        {demandTopLevelItems.length > 0 ? demandTopLevelItems.map((item, index) => (
                          <tr key={`${item.nomenclature_code || index}-${index}`} className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]">
                            <td className="px-3 py-2.5 font-medium text-slate-100">{item.nomenclature_code || "—"}</td>
                            <td className="px-3 py-2.5 text-slate-300">{item.nomenclature_name || "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatQty(item.sales_plan_qty)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatQty(item.safety_stock_qty)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatQty(item.available_qty)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatQty(item.gross_demand_qty)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{formatQty(item.net_production_demand_qty)}</td>
                          </tr>
                        )) : <tr><td className="px-3 py-4 text-slate-400" colSpan={7}>Верхний спрос не сформирован.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="glass-panel p-5">
                  <div className="flex flex-wrap items-end justify-between gap-3"><h3 className="text-lg font-semibold text-slate-50">Потребность к выпуску</h3><div className="text-sm text-slate-400">Позиций: <span className="tabular-nums text-slate-100">{demandInternalItems.length}</span></div></div>
                  <div className="mt-4 max-h-[360px] overflow-auto border border-cyan-300/10">
                    <table className="min-w-full text-left text-sm text-slate-200">
                      <thead className="sticky top-0 bg-[rgba(8,22,34,0.95)] text-[11px] uppercase tracking-[0.08em] text-slate-500"><tr><th className="px-3 py-2">Код</th><th className="px-3 py-2">Наименование</th><th className="px-3 py-2 text-right">Количество к выпуску</th></tr></thead>
                      <tbody>
                        {demandInternalItems.length > 0 ? demandInternalItems.map((item, index) => (
                          <tr key={`${item.nomenclature_code || index}-${index}`} className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]">
                            <td className="px-3 py-2.5 font-medium text-slate-100">{item.nomenclature_code || "—"}</td>
                            <td className="px-3 py-2.5 text-slate-300">{item.nomenclature_name || "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{formatQty(item.required_qty)}</td>
                          </tr>
                        )) : <tr><td className="px-3 py-4 text-slate-400" colSpan={3}>Потребность к выпуску не сформирована.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="glass-panel p-5">
                  <div className="flex flex-wrap items-end justify-between gap-3"><h3 className="text-lg font-semibold text-slate-50">Внешняя потребность</h3><div className="text-sm text-slate-400">Позиций: <span className="tabular-nums text-slate-100">{demandExternalItems.length}</span></div></div>
                  <div className="mt-4 max-h-[360px] overflow-auto border border-cyan-300/10">
                    <table className="min-w-full text-left text-sm text-slate-200">
                      <thead className="sticky top-0 bg-[rgba(8,22,34,0.95)] text-[11px] uppercase tracking-[0.08em] text-slate-500"><tr><th className="px-3 py-2">Код / Внешний вход</th><th className="px-3 py-2">Наименование</th><th className="px-3 py-2 text-right">Количество</th></tr></thead>
                      <tbody>
                        {demandExternalItems.length > 0 ? demandExternalItems.map((item, index) => (
                          <tr key={`${item.nomenclature_code || item.external_input_name || index}-${index}`} className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]">
                            <td className="px-3 py-2.5 font-medium text-slate-100">{item.nomenclature_code || item.external_input_name || "—"}</td>
                            <td className="px-3 py-2.5 text-slate-300">{item.nomenclature_name || item.external_input_name || "—"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{formatQty(item.required_qty)}</td>
                          </tr>
                        )) : <tr><td className="px-3 py-4 text-slate-400" colSpan={3}>Внешняя потребность не сформирована.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={["glass-panel p-5", demandProblemItems.length > 0 ? "border-amber-300/30 bg-amber-400/[0.05]" : ""].join(" ")}>
                  <h3 className="text-lg font-semibold text-slate-50">Проблемы расчёта</h3>
                  {demandProblemItems.length > 0 ? (
                    <div className="mt-4 max-h-[320px] overflow-auto border border-amber-300/20">
                      <table className="min-w-full text-left text-sm text-slate-200">
                        <thead className="sticky top-0 bg-[rgba(24,20,10,0.55)] text-[11px] uppercase tracking-[0.08em] text-amber-100/70"><tr><th className="px-3 py-2">Код проблемы</th><th className="px-3 py-2">Сообщение</th><th className="px-3 py-2">Номенклатура</th><th className="px-3 py-2">Маршрут</th><th className="px-3 py-2">Детали</th></tr></thead>
                        <tbody>
                          {demandProblemItems.map((problem, index) => (
                            <tr key={`${problem.problem_code || "problem"}-${index}`} className="border-t border-white/[0.05]">
                              <td className="px-3 py-2.5 font-medium text-amber-50">{problem.problem_code || "—"}</td>
                              <td className="px-3 py-2.5 text-slate-200">{problem.message || "—"}</td>
                              <td className="px-3 py-2.5 text-slate-300">{problem.nomenclature_code || "—"}</td>
                              <td className="px-3 py-2.5 tabular-nums text-slate-300">{problem.route_id ?? "—"}</td>
                              <td className="px-3 py-2.5 text-slate-300">{problem.details ? JSON.stringify(problem.details) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mt-3 border border-emerald-300/30 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-100">Проблемы расчёта не обнаружены.</div>
                  )}
                </section>
              </>
            )}
          </div>

          <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
            <div className="panel-title">Контекст</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Параметры расчёта</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Проверьте период, дату остатков и состав исходных данных перед запуском расчёта.
            </p>

            <div className="panel-divider mt-5" />

            <div className="mt-4 rounded-none border border-white/8 bg-white/[0.025] px-4 py-4">
              <div className="text-sm font-medium text-slate-100">Параметры</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Период планирования</span><span className="font-medium text-slate-100">{formatMonthLabel(planMonth)}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Дата остатков</span><span className="font-medium text-slate-100">{balanceDate || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">План продаж</span><span className="font-medium tabular-nums text-slate-100">{salesPlanItems.length} строк</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Остатки / страховой запас</span><span className="font-medium tabular-nums text-slate-100">{inventoryItems.length} / {safetyStockItems.length}</span></div>
              </div>
            </div>

            <div className="mt-4 rounded-none border border-white/8 bg-white/[0.025] px-4 py-4">
              <div className="text-sm font-medium text-slate-100">Сводка результата</div>
              {demandResult ? (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Верхний спрос</span><span className="font-medium tabular-nums text-slate-100">{demandTopLevelItems.length}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Потребность к выпуску</span><span className="font-medium tabular-nums text-slate-100">{demandInternalItems.length}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Внешняя потребность</span><span className="font-medium tabular-nums text-slate-100">{demandExternalItems.length}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className={demandProblemItems.length > 0 ? "text-amber-200" : "text-slate-500"}>Проблемы</span><span className={["font-medium tabular-nums", demandProblemItems.length > 0 ? "text-amber-100" : "text-emerald-100"].join(" ")}>{demandProblemItems.length}</span></div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Расчёт ещё не выполнен.</p>
              )}
            </div>

            <div className="mt-4 rounded-none border border-white/8 bg-white/[0.025] px-4 py-4">
              <div className="text-sm font-medium text-slate-100">Статус</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Последний расчёт</span><span className="font-medium text-slate-100">{lastCalculatedAt ? new Date(lastCalculatedAt).toLocaleString("ru-RU") : "—"}</span></div>
                <div className="text-slate-400">
                  {!balanceDate
                    ? "Дата остатков не выбрана."
                    : inventoryBalanceDates.length > 0 && balanceDate === inventoryBalanceDates[0]
                      ? "Остатки: используется последняя загрузка."
                      : "Остатки: выбран прошлый снимок."}
                </div>
              </div>
            </div>

            {demandResult?.problems?.length > 0 ? (
              <div className="mt-4 rounded-none border border-amber-300/30 bg-amber-400/[0.08] px-4 py-3 text-sm text-amber-100">
                Есть проблемы расчёта. Проверьте таблицу “Проблемы расчёта” ниже.
              </div>
            ) : null}
          </aside>
        </section>
      ) : null}

      {activeModuleTab === MODULE_TAB_RESULTS ? (
        <section className="glass-panel p-6 sm:p-7">
          <div className="panel-title">Результаты</div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">Результаты расчёта</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            {demandResult ? "Последний расчёт доступен во вкладке Расчёт потребности." : "Результаты пока не сформированы. Выполните расчёт потребности во вкладке Расчёт потребности."}
          </p>
        </section>
      ) : null}
    </section>
  );
}

export default DemandSection;



