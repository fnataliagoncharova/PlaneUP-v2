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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  downloadInventoryBalanceImportTemplate,
  getInventoryBalanceDates,
  getInventoryBalanceList,
  previewInventoryBalanceImport,
  updateInventoryBalanceItem,
} from "../services/inventoryBalanceApi";
import {
  createInventoryBalanceDegassing,
  deleteInventoryBalanceDegassing,
  downloadInventoryBalanceDegassingTemplate,
  downloadInventoryDegassingSuggestionReport,
  getInventoryBalanceDegassing,
  getInventoryDegassingSuggestionReport,
  importInventoryBalanceDegassing,
  updateInventoryBalanceDegassing,
} from "../services/inventoryBalanceDegassingApi";
import {
  commitSafetyStockImport,
  createSafetyStockItem,
  deleteSafetyStockItem,
  downloadSafetyStockImportTemplate,
  getSafetyStockList,
  previewSafetyStockImport,
  updateSafetyStockItem,
} from "../services/safetyStockApi";
import {
  commitSalesPlanImport,
  createSalesPlanItem,
  deleteSalesPlanItem,
  downloadSalesPlanImportTemplate,
  getSalesPlanList,
  previewSalesPlanImport,
  updateSalesPlanItem,
} from "../services/salesPlanApi";
import { calculateDemand } from "../services/demandApi";
import {
  createProductionPlanFromDemand,
  getProductionPlans,
  refreshProductionPlanFromDemand,
} from "../services/productionPlansApi";
import { useRole } from "../auth/useRole";

const MODULE_TAB_SOURCE_DATA = "source_data";
const MODULE_TAB_CALCULATE = "demand_calculate";

const IMPORT_CONTEXT_SALES_PLAN = "sales_plan";
const IMPORT_CONTEXT_INVENTORY_BALANCE = "inventory_balance";
const IMPORT_CONTEXT_SAFETY_STOCK = "safety_stock";

const MODULE_TABS = [
  { id: MODULE_TAB_SOURCE_DATA, label: "Исходные данные" },
  { id: MODULE_TAB_CALCULATE, label: "Расчёт потребности" },
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
    return "";
  }
  return monthValue;
}

function formatQty(value) {
  if (value === null || value === undefined || value === "") {
    return "";
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

function formatQtyWithUnit(value, unitOfMeasure) {
  const qtyText = formatQty(value);
  if (!qtyText) {
    return "";
  }
  return `${qtyText} ${String(unitOfMeasure || "").trim()}`.trim();
}

function formatDateTimeLabel(value) {
  if (!value) {
    return "—";
  }

  const normalized = String(value).trim().replace(" ", "T");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function splitDateTimeParts(value) {
  const normalized = String(value || "").trim().replace(" ", "T");
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (match) {
    return {
      date: match[1],
      time: match[2],
    };
  }

  return {
    date: "",
    time: "07:00",
  };
}

function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) {
    return "";
  }
  return `${dateValue}T${timeValue}:00`;
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

function resolveErrorMessages(error, fallbackMessage) {
  const details = Array.isArray(error?.details) ? error.details.filter(Boolean) : [];
  if (details.length > 0) {
    return details;
  }

  if (error?.message) {
    return String(error.message)
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [fallbackMessage];
}

function getDemandPermissionErrorMessage(error, actionType = "edit") {
  if (!(error?.status === 403 || error?.message === "Forbidden")) {
    return null;
  }

  if (actionType === "view") {
    return "Недостаточно прав для просмотра потребности.";
  }

  return "Недостаточно прав для изменения данных потребности.";
}

function normalizeLookbackDays(value, fallbackValue = 7) {
  const parsedValue = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallbackValue;
  }
  return parsedValue;
}

function formatShiftLabel(value) {
  return value === "night" ? "ночь" : "день";
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

function DemandResultTableColGroup({ numericColumns = 1 }) {
  return (
    <colgroup>
      <col className="w-[120px]" />
      <col className="w-[360px]" />
      <col className="w-[72px]" />
      {Array.from({ length: numericColumns }).map((_, index) => (
        <col key={index} className="w-[148px]" />
      ))}
    </colgroup>
  );
}

function DemandSection() {
  const { user } = useRole();
  const canViewDemand = user?.role === "admin" || user?.role === "planner" || user?.role === "viewer";
  const canCalculateDemand = user?.role === "admin" || user?.role === "planner";
  const canCreateProductionPlanFromDemand = user?.role === "admin" || user?.role === "planner";
  const canEditDemandInputs = user?.role === "admin" || user?.role === "planner";

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
  const [inventoryDegassingItems, setInventoryDegassingItems] = useState([]);
  const [isInventoryDegassingLoading, setIsInventoryDegassingLoading] = useState(false);
  const [inventoryDegassingError, setInventoryDegassingError] = useState("");
  const [inventoryDegassingNomenclatureId, setInventoryDegassingNomenclatureId] = useState("");
  const [isInventoryDegassingFormOpen, setIsInventoryDegassingFormOpen] = useState(false);
  const [inventoryDegassingFormMode, setInventoryDegassingFormMode] = useState("create");
  const [inventoryDegassingFormItem, setInventoryDegassingFormItem] = useState(null);
  const [inventoryDegassingFormError, setInventoryDegassingFormError] = useState("");
  const [isInventoryDegassingSaving, setIsInventoryDegassingSaving] = useState(false);
  const [inventoryDegassingFormAsOfDate, setInventoryDegassingFormAsOfDate] = useState("");
  const [inventoryDegassingFormNomenclatureId, setInventoryDegassingFormNomenclatureId] = useState("");
  const [inventoryDegassingFormQty, setInventoryDegassingFormQty] = useState("");
  const [inventoryDegassingFormAvailableDate, setInventoryDegassingFormAvailableDate] = useState("");
  const [inventoryDegassingFormAvailableTime, setInventoryDegassingFormAvailableTime] = useState("07:00");
  const [inventoryDegassingFormComment, setInventoryDegassingFormComment] = useState("");
  const [inventoryDegassingDeleteCandidate, setInventoryDegassingDeleteCandidate] = useState(null);
  const [inventoryDegassingDeleteError, setInventoryDegassingDeleteError] = useState("");
  const [deletingInventoryDegassingId, setDeletingInventoryDegassingId] = useState(null);
  const [isInventoryDegassingImporting, setIsInventoryDegassingImporting] = useState(false);
  const [isInventoryDegassingTemplateDownloading, setIsInventoryDegassingTemplateDownloading] = useState(false);
  const [inventoryDegassingImportError, setInventoryDegassingImportError] = useState("");
  const [inventoryDegassingImportErrors, setInventoryDegassingImportErrors] = useState([]);
  const [inventoryDegassingImportSuccess, setInventoryDegassingImportSuccess] = useState("");
  const [pendingInventoryDegassingImportFile, setPendingInventoryDegassingImportFile] = useState(null);
  const [isInventoryDegassingImportConfirmOpen, setIsInventoryDegassingImportConfirmOpen] = useState(false);
  const [isInventoryDegassingSuggestionOpen, setIsInventoryDegassingSuggestionOpen] = useState(false);
  const [isInventoryDegassingSuggestionLoading, setIsInventoryDegassingSuggestionLoading] = useState(false);
  const [inventoryDegassingSuggestionError, setInventoryDegassingSuggestionError] = useState("");
  const [inventoryDegassingSuggestionErrors, setInventoryDegassingSuggestionErrors] = useState([]);
  const [inventoryDegassingSuggestionItems, setInventoryDegassingSuggestionItems] = useState([]);
  const [inventoryDegassingSuggestionMeta, setInventoryDegassingSuggestionMeta] = useState(null);
  const [inventoryDegassingSuggestionLookbackDays, setInventoryDegassingSuggestionLookbackDays] = useState("7");
  const [isInventoryDegassingSuggestionDownloading, setIsInventoryDegassingSuggestionDownloading] = useState(false);
  const inventoryDegassingFileInputRef = useRef(null);

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
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false);
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
  const [isCreatingProductionPlan, setIsCreatingProductionPlan] = useState(false);
  const [productionPlanCreateError, setProductionPlanCreateError] = useState("");
  const [productionPlanCreateSuccess, setProductionPlanCreateSuccess] = useState("");
  const [productionPlanRefreshCandidate, setProductionPlanRefreshCandidate] = useState(null);
  const [isRefreshingProductionPlan, setIsRefreshingProductionPlan] = useState(false);
  const [isRefreshProductionPlanConfirmOpen, setIsRefreshProductionPlanConfirmOpen] = useState(false);

  useEffect(() => {
    if (!MODULE_TABS.some((tab) => tab.id === activeModuleTab)) {
      setActiveModuleTab(MODULE_TAB_CALCULATE);
    }
  }, [activeModuleTab]);

  const reloadSalesPlan = useCallback(async () => {
    if (!canViewDemand) {
      setSalesPlanItems([]);
      setSalesPlanError("");
      setIsSalesPlanLoading(false);
      return;
    }

    setIsSalesPlanLoading(true);
    setSalesPlanError("");

    try {
      const response = await getSalesPlanList(monthToApiDate(planMonth));
      setSalesPlanItems(Array.isArray(response) ? response : []);
    } catch (error) {
      setSalesPlanItems([]);
      setSalesPlanError(
        getDemandPermissionErrorMessage(error, "view") || error.message || "Не удалось загрузить план продаж.",
      );
    } finally {
      setIsSalesPlanLoading(false);
    }
  }, [canViewDemand, planMonth]);

  const reloadInventoryBalance = useCallback(async () => {
    if (!canViewDemand) {
      setInventoryItems([]);
      setInventoryError("");
      setIsInventoryLoading(false);
      return;
    }

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
      setInventoryError(
        getDemandPermissionErrorMessage(error, "view") || error.message || "Не удалось загрузить остатки.",
      );
    } finally {
      setIsInventoryLoading(false);
    }
  }, [balanceDate, canViewDemand]);

  const reloadInventoryDegassing = useCallback(async () => {
    if (!canViewDemand) {
      setInventoryDegassingItems([]);
      setInventoryDegassingError("");
      setIsInventoryDegassingLoading(false);
      return;
    }

    if (!balanceDate) {
      setInventoryDegassingItems([]);
      setInventoryDegassingError("");
      setIsInventoryDegassingLoading(false);
      return;
    }

    setIsInventoryDegassingLoading(true);
    setInventoryDegassingError("");

    try {
      const response = await getInventoryBalanceDegassing({
        as_of_date: balanceDate,
        nomenclature_id: inventoryDegassingNomenclatureId
          ? Number(inventoryDegassingNomenclatureId)
          : undefined,
      });
      setInventoryDegassingItems(Array.isArray(response) ? response : []);
    } catch (error) {
      setInventoryDegassingItems([]);
      setInventoryDegassingError(
        getDemandPermissionErrorMessage(error, "view") || error.message || "Не удалось загрузить остатки в дегазации.",
      );
    } finally {
      setIsInventoryDegassingLoading(false);
    }
  }, [balanceDate, canViewDemand, inventoryDegassingNomenclatureId]);

  const reloadInventoryBalanceDates = useCallback(async () => {
    if (!canViewDemand) {
      setInventoryBalanceDates([]);
      setInventoryDatesError("");
      setIsInventoryDatesLoading(false);
      return;
    }

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
      setInventoryDatesError(
        getDemandPermissionErrorMessage(error, "view") ||
          error.message ||
          "Не удалось загрузить список дат остатков.",
      );
    } finally {
      setIsInventoryDatesLoading(false);
    }
  }, [balanceDate, canViewDemand]);

  const reloadSafetyStock = useCallback(async () => {
    if (!canViewDemand) {
      setSafetyStockItems([]);
      setSafetyStockError("");
      setIsSafetyStockLoading(false);
      return;
    }

    setIsSafetyStockLoading(true);
    setSafetyStockError("");

    try {
      const response = await getSafetyStockList();
      setSafetyStockItems(Array.isArray(response) ? response : []);
    } catch (error) {
      setSafetyStockItems([]);
      setSafetyStockError(
        getDemandPermissionErrorMessage(error, "view") || error.message || "Не удалось загрузить страховой запас.",
      );
    } finally {
      setIsSafetyStockLoading(false);
    }
  }, [canViewDemand]);

  useEffect(() => {
    if (!canViewDemand) {
      return;
    }
    reloadSalesPlan();
  }, [canViewDemand, reloadSalesPlan]);

  useEffect(() => {
    if (!canViewDemand) {
      return;
    }
    reloadInventoryBalanceDates();
  }, [canViewDemand, reloadInventoryBalanceDates]);

  useEffect(() => {
    if (!canViewDemand) {
      return;
    }
    reloadInventoryBalance();
  }, [canViewDemand, reloadInventoryBalance]);

  useEffect(() => {
    if (!canViewDemand) {
      return;
    }
    reloadInventoryDegassing();
  }, [canViewDemand, reloadInventoryDegassing]);

  useEffect(() => {
    if (!canViewDemand) {
      return;
    }
    reloadSafetyStock();
  }, [canViewDemand, reloadSafetyStock]);

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
      setIsInventoryDegassingFormOpen(false);
      setInventoryDegassingFormError("");
      setInventoryDegassingDeleteError("");
      setInventoryDegassingDeleteCandidate(null);
      setInventoryDegassingFormItem(null);
      setInventoryDegassingNomenclatureId("");
      setPendingInventoryDegassingImportFile(null);
      setIsInventoryDegassingImportConfirmOpen(false);
      setIsInventoryDegassingSuggestionOpen(false);
      setInventoryDegassingSuggestionError("");
      setInventoryDegassingSuggestionErrors([]);
      setInventoryDegassingSuggestionItems([]);
      setInventoryDegassingSuggestionMeta(null);
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
    if (!canViewDemand) {
      return;
    }

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
  }, [activeSourceTab, canViewDemand, isNomenclatureLoading, nomenclatureItems.length]);

  useEffect(() => {
    if (!canViewDemand) {
      return;
    }

    if (activeSourceTab === IMPORT_CONTEXT_INVENTORY_BALANCE && nomenclatureItems.length === 0) {
      loadNomenclatureItems();
    }
  }, [activeSourceTab, canViewDemand, loadNomenclatureItems, nomenclatureItems.length]);

  const filteredSalesPlanItems = useMemo(
    () => filterItemsBySearch(salesPlanItems, salesPlanSearch),
    [salesPlanItems, salesPlanSearch],
  );
  const filteredInventoryItems = useMemo(
    () => filterItemsBySearch(inventoryItems, inventorySearch),
    [inventoryItems, inventorySearch],
  );
  const sortedNomenclatureItems = useMemo(
    () =>
      [...nomenclatureItems].sort((left, right) =>
        String(left.nomenclature_code || "").localeCompare(String(right.nomenclature_code || ""), "ru"),
      ),
    [nomenclatureItems],
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
  const canCreateProductionPlan = canCreateProductionPlanFromDemand && demandResult && demandInternalItems.length > 0;
  const selectedInventoryDegassingFormNomenclature = sortedNomenclatureItems.find(
    (item) => String(item.nomenclature_id) === String(inventoryDegassingFormNomenclatureId || ""),
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
            : "Дата остатков: не выбрана",
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

  useEffect(() => {
    if (!isImportOpen) {
      return;
    }

    if (importContext === activeSourceTab) {
      return;
    }

    setImportContext(activeSourceTab);
    setImportErrorContext(activeSourceTab);
    resetImportState();
  }, [activeSourceTab, importContext, isImportOpen, resetImportState]);

  const handleOpenImportPanel = (context) => {
    if (!canEditDemandInputs) {
      setImportError("Недостаточно прав для изменения данных потребности.");
      return;
    }

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

  const handleDownloadTemplate = async (context = importContext) => {
    if (!canEditDemandInputs) {
      setImportError("Недостаточно прав для изменения данных потребности.");
      return;
    }

    const resolvedContext = context || activeSourceTab;
    if (!resolvedContext) {
      return;
    }

    setImportError("");
    setImportErrorContext(resolvedContext);
    setIsTemplateDownloading(true);

    try {
      let templateBlob = null;
      let fileName = "";

      if (resolvedContext === IMPORT_CONTEXT_SALES_PLAN) {
        templateBlob = await downloadSalesPlanImportTemplate();
        fileName = "sales_plan_import_template.xlsx";
      } else if (resolvedContext === IMPORT_CONTEXT_INVENTORY_BALANCE) {
        templateBlob = await downloadInventoryBalanceImportTemplate();
        fileName = "inventory_balance_import_template.xlsx";
      } else {
        templateBlob = await downloadSafetyStockImportTemplate();
        fileName = "safety_stock_import_template.xlsx";
      }

      if (!templateBlob) {
        throw new Error("Не удалось скачать шаблон Excel.");
      }

      const blobUrl = URL.createObjectURL(templateBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      setImportError(
        getDemandPermissionErrorMessage(error) || error.message || "Не удалось скачать шаблон Excel.",
      );
    } finally {
      setIsTemplateDownloading(false);
    }
  };

  const handleImportFileChange = (nextFile) => {
    setImportFile(nextFile);
    setPreviewData(null);
    setCommitResult(null);
    setImportError("");
  };

  const handlePreviewImport = async () => {
    if (!canEditDemandInputs) {
      setImportError("Недостаточно прав для изменения данных потребности.");
      return;
    }

    if (!importFile) {
      setImportError("Выберите Excel-файл для предпросмотра.");
      return;
    }

    const resolvedContext = importContext || activeSourceTab;

    setIsPreviewLoading(true);
    setImportError("");
    setCommitResult(null);

    try {
      let response = null;

      if (resolvedContext === IMPORT_CONTEXT_SALES_PLAN) {
        response = await previewSalesPlanImport(importFile);
      } else if (resolvedContext === IMPORT_CONTEXT_INVENTORY_BALANCE) {
        response = await previewInventoryBalanceImport(importFile);
      } else {
        response = await previewSafetyStockImport(importFile);
      }

      setPreviewData(response);
    } catch (error) {
      setPreviewData(null);
      setImportError(
        getDemandPermissionErrorMessage(error) ||
          error.message ||
          "Не удалось подготовить предпросмотр импорта.",
      );
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!canEditDemandInputs) {
      setImportError("Недостаточно прав для изменения данных потребности.");
      return;
    }

    if (!importFile) {
      setImportError("Выберите Excel-файл для импорта.");
      return;
    }

    if (!previewData) {
      setImportError("Сначала выполните предпросмотр файла.");
      return;
    }

    const resolvedContext = importContext || activeSourceTab;

    setIsCommitLoading(true);
    setImportError("");

    try {
      let response = null;

      if (resolvedContext === IMPORT_CONTEXT_SALES_PLAN) {
        response = await commitSalesPlanImport(importFile);
      } else if (resolvedContext === IMPORT_CONTEXT_INVENTORY_BALANCE) {
        response = await commitInventoryBalanceImport(importFile);
      } else {
        response = await commitSafetyStockImport(importFile);
      }

      setCommitResult(response);

      if (resolvedContext === IMPORT_CONTEXT_SALES_PLAN) {
        await reloadSalesPlan();
      } else if (resolvedContext === IMPORT_CONTEXT_INVENTORY_BALANCE) {
        await reloadInventoryBalanceDates();
        await reloadInventoryBalance();
      } else {
        await reloadSafetyStock();
      }
    } catch (error) {
      setImportError(
        getDemandPermissionErrorMessage(error) || error.message || "Не удалось выполнить импорт.",
      );
    } finally {
      setIsCommitLoading(false);
    }
  };

  const renderImportPanel = () => {
    if (!isImportOpen || !canEditDemandInputs) {
      return null;
    }

    const resolvedContext = importContext || activeSourceTab;

    if (resolvedContext === IMPORT_CONTEXT_INVENTORY_BALANCE) {
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
          isTemplateDownloading={isTemplateDownloading}
        />
      );
    }

    if (resolvedContext === IMPORT_CONTEXT_SAFETY_STOCK) {
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
          isTemplateDownloading={isTemplateDownloading}
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
        isTemplateDownloading={isTemplateDownloading}
      />
    );
  };

  const handleCalculateDemand = async () => {
    setDemandCalculateError("");
    setProductionPlanCreateError("");
    setProductionPlanCreateSuccess("");
    setProductionPlanRefreshCandidate(null);
    setIsRefreshProductionPlanConfirmOpen(false);

    if (!canCalculateDemand) {
      setDemandCalculateError("Недостаточно прав для изменения данных потребности.");
      return;
    }

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
      setDemandCalculateError(
        getDemandPermissionErrorMessage(error) || error.message || "Не удалось выполнить расчёт потребности.",
      );
    } finally {
      setIsDemandCalculating(false);
    }
  };

  const handleCreateProductionPlan = async () => {
    setProductionPlanCreateError("");
    setProductionPlanCreateSuccess("");
    setProductionPlanRefreshCandidate(null);
    setIsRefreshProductionPlanConfirmOpen(false);

    if (!canCreateProductionPlanFromDemand) {
      setProductionPlanCreateError("Недостаточно прав для изменения данных потребности.");
      return;
    }

    if (!demandResult) {
      setProductionPlanCreateError("Сначала выполните расчёт потребности.");
      return;
    }

    const planDate = demandResult?.plan_date || monthToApiDate(planMonth);
    if (!planDate) {
      setProductionPlanCreateError("Не определён период планирования для формирования плана.");
      return;
    }

    const demandLines = Array.isArray(demandResult?.internal_production_demand)
      ? demandResult.internal_production_demand
      : [];
    const lines = demandLines
      .filter((row) => Number(row?.nomenclature_id) > 0 && Number(row?.required_qty) > 0)
      .map((row) => ({
        nomenclature_id: Number(row.nomenclature_id),
        required_qty: row.required_qty,
        is_priority: false,
        priority_note: null,
        line_comment: null,
      }));

    if (lines.length === 0) {
      setProductionPlanCreateError("Нет корректных строк потребности к выпуску для формирования плана.");
      return;
    }

    const planMonthLabel = String(planDate).slice(0, 7);
    const payload = {
      plan_month: planDate,
      source_balance_date: demandResult?.balance_date || balanceDate || null,
      source_calculated_at: lastCalculatedAt || new Date().toISOString(),
      plan_name: `План выпуска на ${planMonthLabel}`,
      comment: "Сформирован из расчёта потребности",
      lines,
    };

    setIsCreatingProductionPlan(true);
    try {
      const createdPlan = await createProductionPlanFromDemand(payload);
      setProductionPlanCreateSuccess(
        `План выпуска создан. ${createdPlan?.plan_name || payload.plan_name} · ${String(createdPlan?.plan_month || planDate).slice(0, 7)} · строк: ${Array.isArray(createdPlan?.lines) ? createdPlan.lines.length : lines.length}. Откройте раздел “Планирование выпуска”, чтобы продолжить работу с планом.`,
      );
      setProductionPlanRefreshCandidate(null);
      setIsRefreshProductionPlanConfirmOpen(false);
    } catch (error) {
      const message = getDemandPermissionErrorMessage(error) || error?.message || "Не удалось сформировать план выпуска.";
      if (message.includes("План выпуска за выбранный месяц уже существует")) {
        setProductionPlanCreateError(
          "План выпуска за этот месяц уже существует.",
        );
        try {
          const plans = await getProductionPlans();
          const existingPlan = (Array.isArray(plans) ? plans : []).find(
            (plan) => String(plan?.plan_month || "").slice(0, 10) === String(planDate).slice(0, 10),
          );
          if (!existingPlan) {
            setProductionPlanCreateError("План за этот месяц не найден в списке планов.");
          } else {
            if (existingPlan.status === "approved") {
              setProductionPlanRefreshCandidate(null);
              setIsRefreshProductionPlanConfirmOpen(false);
              setProductionPlanCreateError(
                "План выпуска за этот месяц уже утверждён. Чтобы обновить его из расчёта, откройте раздел “Планирование выпуска” и верните план в черновик.",
              );
              return;
            }
            setProductionPlanRefreshCandidate({
              productionPlanId: existingPlan.production_plan_id,
              planName: existingPlan.plan_name,
              planMonth: existingPlan.plan_month,
              payload: {
                source_balance_date: demandResult?.balance_date || balanceDate || null,
                source_calculated_at: lastCalculatedAt || new Date().toISOString(),
                comment: null,
                lines: lines.map((line) => ({
                  nomenclature_id: line.nomenclature_id,
                  required_qty: line.required_qty,
                })),
              },
            });
          }
        } catch (lookupError) {
          setProductionPlanCreateError(
            lookupError?.message || "Не удалось получить список планов для обновления.",
          );
        }
      } else {
        setProductionPlanCreateError(message);
      }
    } finally {
      setIsCreatingProductionPlan(false);
    }
  };

  const handleConfirmRefreshProductionPlan = async () => {
    if (!productionPlanRefreshCandidate) {
      return;
    }

    if (!canCreateProductionPlanFromDemand) {
      setProductionPlanCreateError("Недостаточно прав для изменения данных потребности.");
      return;
    }

    setProductionPlanCreateError("");
    setProductionPlanCreateSuccess("");
    setIsRefreshingProductionPlan(true);

    try {
      const refreshedPlan = await refreshProductionPlanFromDemand(
        productionPlanRefreshCandidate.productionPlanId,
        productionPlanRefreshCandidate.payload,
      );
      const linesCount = Array.isArray(refreshedPlan?.lines)
        ? refreshedPlan.lines.length
        : productionPlanRefreshCandidate.payload.lines.length;
      setProductionPlanCreateSuccess(
        `План выпуска обновлён из расчёта. ${refreshedPlan?.plan_name || productionPlanRefreshCandidate.planName} · ${String(refreshedPlan?.plan_month || productionPlanRefreshCandidate.planMonth).slice(0, 7)} · строк: ${linesCount}. Откройте раздел “Планирование выпуска”, чтобы продолжить работу с планом.`,
      );
      setProductionPlanRefreshCandidate(null);
      setIsRefreshProductionPlanConfirmOpen(false);
    } catch (error) {
      const message =
        getDemandPermissionErrorMessage(error) ||
        error?.message ||
        "Не удалось обновить существующий план из расчёта.";
      if (message.includes("Утверждённый план выпуска нельзя обновить из расчёта")) {
        setProductionPlanRefreshCandidate(null);
        setIsRefreshProductionPlanConfirmOpen(false);
        setProductionPlanCreateError(
          "План выпуска уже утверждён. Верните его в черновик в разделе “Планирование выпуска”, затем повторите обновление из расчёта.",
        );
      } else {
        setProductionPlanCreateError(message);
      }
    } finally {
      setIsRefreshingProductionPlan(false);
    }
  };

  const handleOpenCreateSalesPlanForm = async () => {
    if (!canEditDemandInputs) {
      setSalesPlanFormError("Недостаточно прав для изменения данных потребности.");
      return;
    }

    setSalesPlanFormMode("create");
    setSalesPlanFormItem(null);
    setSalesPlanFormError("");
    setSalesPlanFormQty("");
    setSalesPlanFormNomenclatureId("");
    setIsSalesPlanFormOpen(true);
    await loadNomenclatureItems();
  };

  const handleOpenEditSalesPlanForm = (item) => {
    if (!canEditDemandInputs) {
      setSalesPlanFormError("Недостаточно прав для изменения данных потребности.");
      return;
    }

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
        setSalesPlanFormError(
          getDemandPermissionErrorMessage(error) || error.message || "Не удалось сохранить строку плана продаж.",
        );
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
      setSalesPlanDeleteError(
        getDemandPermissionErrorMessage(error) || error.message || "Не удалось удалить строку плана продаж.",
      );
    } finally {
      setDeletingSalesPlanId(null);
    }
  };

  const handleOpenCreateInventoryForm = async () => {
    if (!canEditDemandInputs) {
      setInventoryFormError("Недостаточно прав для изменения данных потребности.");
      return;
    }

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
    if (!canEditDemandInputs) {
      setInventoryFormError("Недостаточно прав для изменения данных потребности.");
      return;
    }

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
        setInventoryFormError(
          getDemandPermissionErrorMessage(error) || error.message || "Не удалось сохранить строку остатков.",
        );
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
      setInventoryDeleteError(
        getDemandPermissionErrorMessage(error) || error.message || "Не удалось удалить строку остатков.",
      );
    } finally {
      setDeletingInventoryId(null);
    }
  };

  const handleOpenCreateInventoryDegassingForm = async () => {
    if (!canEditDemandInputs) {
      setInventoryDegassingFormError("Недостаточно прав для изменения данных потребности.");
      return;
    }

    if (!balanceDate) {
      setInventoryDegassingFormError("Сначала загрузите общие остатки. После этого можно указать часть остатков в дегазации.");
      return;
    }

    setInventoryDegassingFormMode("create");
    setInventoryDegassingFormItem(null);
    setInventoryDegassingFormError("");
    setInventoryDegassingFormAsOfDate(balanceDate);
    setInventoryDegassingFormNomenclatureId("");
    setInventoryDegassingFormQty("");
    setInventoryDegassingFormAvailableDate(balanceDate);
    setInventoryDegassingFormAvailableTime("07:00");
    setInventoryDegassingFormComment("");
    setIsInventoryDegassingFormOpen(true);
    await loadNomenclatureItems();
  };

  const handleOpenEditInventoryDegassingForm = async (item) => {
    if (!canEditDemandInputs) {
      setInventoryDegassingFormError("Недостаточно прав для изменения данных потребности.");
      return;
    }

    const { date: availableDate, time: availableTime } = splitDateTimeParts(item?.available_at);
    setInventoryDegassingFormMode("edit");
    setInventoryDegassingFormItem(item);
    setInventoryDegassingFormError("");
    setInventoryDegassingFormAsOfDate(String(item?.as_of_date || balanceDate || ""));
    setInventoryDegassingFormNomenclatureId(String(item?.nomenclature_id || ""));
    setInventoryDegassingFormQty(String(item?.qty ?? ""));
    setInventoryDegassingFormAvailableDate(availableDate);
    setInventoryDegassingFormAvailableTime(availableTime === "19:00" ? "19:00" : "07:00");
    setInventoryDegassingFormComment(String(item?.comment || ""));
    setIsInventoryDegassingFormOpen(true);
    if (nomenclatureItems.length === 0) {
      await loadNomenclatureItems();
    }
  };

  const handleCloseInventoryDegassingForm = () => {
    if (isInventoryDegassingSaving) {
      return;
    }
    setIsInventoryDegassingFormOpen(false);
    setInventoryDegassingFormError("");
  };

  const handleSaveInventoryDegassingForm = async () => {
    if (!inventoryDegassingFormAsOfDate) {
      setInventoryDegassingFormError("Выберите дату остатков.");
      return;
    }

    if (!inventoryDegassingFormNomenclatureId) {
      setInventoryDegassingFormError("Выберите номенклатуру.");
      return;
    }

    const normalizedQtyText = String(inventoryDegassingFormQty ?? "").replace(",", ".").trim();
    const parsedQty = Number(normalizedQtyText);
    if (!normalizedQtyText || !Number.isFinite(parsedQty) || parsedQty <= 0) {
      setInventoryDegassingFormError("Количество должно быть больше 0.");
      return;
    }

    if (!inventoryDegassingFormAvailableDate) {
      setInventoryDegassingFormError("Выберите дату доступности.");
      return;
    }

    if (!["07:00", "19:00"].includes(inventoryDegassingFormAvailableTime)) {
      setInventoryDegassingFormError("Выберите корректное время доступности.");
      return;
    }

    const availableAt = combineDateAndTime(
      inventoryDegassingFormAvailableDate,
      inventoryDegassingFormAvailableTime,
    );
    if (!availableAt) {
      setInventoryDegassingFormError("Укажите дату и время доступности.");
      return;
    }

    setIsInventoryDegassingSaving(true);
    setInventoryDegassingFormError("");
    try {
      if (inventoryDegassingFormMode === "create") {
        await createInventoryBalanceDegassing({
          as_of_date: inventoryDegassingFormAsOfDate,
          nomenclature_id: Number(inventoryDegassingFormNomenclatureId),
          qty: normalizedQtyText,
          available_at: availableAt,
          comment: inventoryDegassingFormComment.trim() || null,
        });
      } else if (inventoryDegassingFormItem?.balance_degassing_id) {
        await updateInventoryBalanceDegassing(inventoryDegassingFormItem.balance_degassing_id, {
          qty: normalizedQtyText,
          available_at: availableAt,
          comment: inventoryDegassingFormComment.trim() || null,
        });
      }

      await reloadInventoryDegassing();
      setIsInventoryDegassingFormOpen(false);
      setInventoryDegassingFormItem(null);
      setInventoryDegassingFormError("");
    } catch (error) {
      setInventoryDegassingFormError(
        getDemandPermissionErrorMessage(error) ||
          error.message ||
          "Не удалось сохранить запись остатков в дегазации.",
      );
    } finally {
      setIsInventoryDegassingSaving(false);
    }
  };

  const handleAskDeleteInventoryDegassing = (item) => {
    setInventoryDegassingDeleteError("");
    setInventoryDegassingDeleteCandidate(item);
  };

  const handleConfirmDeleteInventoryDegassing = async () => {
    if (!inventoryDegassingDeleteCandidate?.balance_degassing_id) {
      return;
    }

    const deletingId = inventoryDegassingDeleteCandidate.balance_degassing_id;
    setDeletingInventoryDegassingId(deletingId);
    setInventoryDegassingDeleteError("");
    try {
      await deleteInventoryBalanceDegassing(deletingId);
      await reloadInventoryDegassing();
      setInventoryDegassingDeleteCandidate(null);
    } catch (error) {
      setInventoryDegassingDeleteCandidate(null);
      setInventoryDegassingDeleteError(
        getDemandPermissionErrorMessage(error) ||
          error.message ||
          "Не удалось удалить запись остатков в дегазации.",
      );
    } finally {
      setDeletingInventoryDegassingId(null);
    }
  };

  const handleDownloadInventoryDegassingTemplate = async () => {
    setInventoryDegassingImportError("");
    setInventoryDegassingImportErrors([]);

    setIsInventoryDegassingTemplateDownloading(true);
    try {
      const templateBlob = await downloadInventoryBalanceDegassingTemplate();
      const blobUrl = URL.createObjectURL(templateBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = "inventory_balance_degassing_template.xlsx";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      const messages = resolveErrorMessages(
        error,
        "Не удалось скачать шаблон остатков в дегазации.",
      );
      const permissionMessage = getDemandPermissionErrorMessage(error);
      const resolvedMessage = permissionMessage || messages[0] || "Не удалось скачать шаблон остатков в дегазации.";
      setInventoryDegassingImportError(resolvedMessage);
      setInventoryDegassingImportErrors(permissionMessage ? [permissionMessage] : messages);
    } finally {
      setIsInventoryDegassingTemplateDownloading(false);
    }
  };

  const handleOpenInventoryDegassingImport = () => {
    if (!canEditDemandInputs) {
      setInventoryDegassingImportError("Недостаточно прав для изменения данных потребности.");
      return;
    }

    if (inventoryBalanceDates.length === 0 || isInventoryDegassingImporting) {
      return;
    }

    setInventoryDegassingImportSuccess("");
    setInventoryDegassingImportError("");
    setInventoryDegassingImportErrors([]);

    if (inventoryDegassingFileInputRef.current) {
      inventoryDegassingFileInputRef.current.value = "";
      inventoryDegassingFileInputRef.current.click();
    }
  };

  const resetInventoryDegassingImportSelection = () => {
    setPendingInventoryDegassingImportFile(null);
    setIsInventoryDegassingImportConfirmOpen(false);

    if (inventoryDegassingFileInputRef.current) {
      inventoryDegassingFileInputRef.current.value = "";
    }
  };

  const handleCancelInventoryDegassingImport = () => {
    if (isInventoryDegassingImporting) {
      return;
    }

    resetInventoryDegassingImportSelection();
  };

  const handleInventoryDegassingFileChange = (event) => {
    if (!canEditDemandInputs) {
      setInventoryDegassingImportError("Недостаточно прав для изменения данных потребности.");
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setPendingInventoryDegassingImportFile(file);
    setIsInventoryDegassingImportConfirmOpen(true);
  };

  const handleConfirmInventoryDegassingImport = async () => {
    if (!canEditDemandInputs) {
      setInventoryDegassingImportError("Недостаточно прав для изменения данных потребности.");
      setInventoryDegassingImportErrors(["Недостаточно прав для изменения данных потребности."]);
      resetInventoryDegassingImportSelection();
      return;
    }

    if (!pendingInventoryDegassingImportFile) {
      return;
    }

    setIsInventoryDegassingImporting(true);
    setInventoryDegassingImportSuccess("");
    setInventoryDegassingImportError("");
    setInventoryDegassingImportErrors([]);

    try {
      const response = await importInventoryBalanceDegassing(pendingInventoryDegassingImportFile);
      await reloadInventoryBalanceDates();
      await reloadInventoryDegassing();

      const importedCount = Number(response?.imported_count ?? 0);
      const affectedDates = Array.isArray(response?.affected_dates) ? response.affected_dates : [];
      const datesLabel = affectedDates.length > 0 ? ` Даты: ${affectedDates.join(", ")}.` : "";
      setInventoryDegassingImportSuccess(
        `${response?.message || "Остатки в дегазации загружены."} Импортировано строк: ${importedCount}.${datesLabel}`,
      );
      resetInventoryDegassingImportSelection();
    } catch (error) {
      const messages = resolveErrorMessages(
        error,
        "Не удалось загрузить остатки в дегазации из Excel.",
      );
      setInventoryDegassingImportError(messages[0] || "Не удалось загрузить остатки в дегазации из Excel.");
      setInventoryDegassingImportErrors(messages);
      resetInventoryDegassingImportSelection();
    } finally {
      setIsInventoryDegassingImporting(false);
    }
  };

  const handleCloseInventoryDegassingSuggestion = () => {
    if (isInventoryDegassingSuggestionLoading || isInventoryDegassingSuggestionDownloading) {
      return;
    }
    setIsInventoryDegassingSuggestionOpen(false);
  };

  const handleLoadInventoryDegassingSuggestion = async (nextLookbackDays) => {
    if (!canEditDemandInputs) {
      setInventoryDegassingSuggestionError("Недостаточно прав для изменения данных потребности.");
      setInventoryDegassingSuggestionErrors(["Недостаточно прав для изменения данных потребности."]);
      return;
    }

    if (!balanceDate) {
      setInventoryDegassingSuggestionError("Сначала выберите дату остатков.");
      setInventoryDegassingSuggestionErrors(["Сначала выберите дату остатков."]);
      setInventoryDegassingSuggestionItems([]);
      setInventoryDegassingSuggestionMeta(null);
      setIsInventoryDegassingSuggestionOpen(true);
      return;
    }

    const normalizedLookbackDays = normalizeLookbackDays(nextLookbackDays, 7);
    setInventoryDegassingSuggestionLookbackDays(String(normalizedLookbackDays));
    setIsInventoryDegassingSuggestionOpen(true);
    setIsInventoryDegassingSuggestionLoading(true);
    setInventoryDegassingSuggestionError("");
    setInventoryDegassingSuggestionErrors([]);

    try {
      const response = await getInventoryDegassingSuggestionReport({
        as_of_date: balanceDate,
        lookback_days: normalizedLookbackDays,
      });
      setInventoryDegassingSuggestionItems(Array.isArray(response?.items) ? response.items : []);
      setInventoryDegassingSuggestionMeta({
        as_of_date: response?.as_of_date || balanceDate,
        check_at: response?.check_at || null,
        lookback_days: response?.lookback_days ?? normalizedLookbackDays,
      });
    } catch (error) {
      const messages = resolveErrorMessages(
        error,
        "Не удалось сформировать отчёт по ПФ в дегазации.",
      );
      const permissionMessage = getDemandPermissionErrorMessage(error);
      const resolvedMessage = permissionMessage || messages[0] || "Не удалось сформировать отчёт по ПФ в дегазации.";
      setInventoryDegassingSuggestionError(resolvedMessage);
      setInventoryDegassingSuggestionErrors(permissionMessage ? [permissionMessage] : messages);
      setInventoryDegassingSuggestionItems([]);
      setInventoryDegassingSuggestionMeta({
        as_of_date: balanceDate,
        check_at: null,
        lookback_days: normalizedLookbackDays,
      });
    } finally {
      setIsInventoryDegassingSuggestionLoading(false);
    }
  };

  const handleOpenInventoryDegassingSuggestion = async () => {
    if (!canEditDemandInputs) {
      setInventoryDegassingSuggestionError("Недостаточно прав для изменения данных потребности.");
      setInventoryDegassingSuggestionErrors(["Недостаточно прав для изменения данных потребности."]);
      return;
    }

    await handleLoadInventoryDegassingSuggestion(inventoryDegassingSuggestionLookbackDays);
  };

  const handleDownloadInventoryDegassingSuggestion = async (lookbackDays = inventoryDegassingSuggestionLookbackDays) => {
    if (!canEditDemandInputs) {
      setInventoryDegassingSuggestionError("Недостаточно прав для изменения данных потребности.");
      setInventoryDegassingSuggestionErrors(["Недостаточно прав для изменения данных потребности."]);
      return;
    }

    if (!balanceDate) {
      setInventoryDegassingSuggestionError("Сначала выберите дату остатков.");
      setInventoryDegassingSuggestionErrors(["Сначала выберите дату остатков."]);
      setIsInventoryDegassingSuggestionOpen(true);
      return;
    }

    const normalizedLookbackDays = normalizeLookbackDays(lookbackDays, 7);
    setInventoryDegassingSuggestionLookbackDays(String(normalizedLookbackDays));
    setIsInventoryDegassingSuggestionDownloading(true);
    setInventoryDegassingSuggestionError("");
    setInventoryDegassingSuggestionErrors([]);

    try {
      const reportBlob = await downloadInventoryDegassingSuggestionReport({
        as_of_date: balanceDate,
        lookback_days: normalizedLookbackDays,
      });
      const blobUrl = URL.createObjectURL(reportBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = `inventory_balance_degassing_suggestion_${balanceDate}.xlsx`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      const messages = resolveErrorMessages(
        error,
        "Не удалось скачать отчёт по ПФ в дегазации.",
      );
      const permissionMessage = getDemandPermissionErrorMessage(error);
      const resolvedMessage = permissionMessage || messages[0] || "Не удалось скачать отчёт по ПФ в дегазации.";
      setInventoryDegassingSuggestionError(resolvedMessage);
      setInventoryDegassingSuggestionErrors(permissionMessage ? [permissionMessage] : messages);
      setIsInventoryDegassingSuggestionOpen(true);
    } finally {
      setIsInventoryDegassingSuggestionDownloading(false);
    }
  };

  const handleOpenCreateSafetyStockForm = async () => {
    if (!canEditDemandInputs) {
      setSafetyStockFormError("Недостаточно прав для изменения данных потребности.");
      return;
    }

    setSafetyStockFormMode("create");
    setSafetyStockFormItem(null);
    setSafetyStockFormError("");
    setSafetyStockFormQty("");
    setSafetyStockFormNomenclatureId("");
    setIsSafetyStockFormOpen(true);
    await loadNomenclatureItems();
  };

  const handleOpenEditSafetyStockForm = (item) => {
    if (!canEditDemandInputs) {
      setSafetyStockFormError("Недостаточно прав для изменения данных потребности.");
      return;
    }

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
        setSafetyStockFormError(
          getDemandPermissionErrorMessage(error) || error.message || "Не удалось сохранить строку страхового запаса.",
        );
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
      setSafetyStockDeleteError(
        getDemandPermissionErrorMessage(error) || error.message || "Не удалось удалить строку страхового запаса.",
      );
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
        selectionDateText: balanceDate ? `Дата остатков: ${balanceDate}` : "Дата остатков: не выбрана",
        latestDateText: inventoryBalanceDates[0] || "нет",
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
  const isInventorySourceTab = activeSourceTab === IMPORT_CONTEXT_INVENTORY_BALANCE;
  const showInventorySearchEmpty =
    !isInventoryLoading &&
    !inventoryError &&
    inventoryItems.length > 0 &&
    filteredInventoryItems.length === 0;
  const showInventoryNoData =
    !isInventoryLoading &&
    !inventoryError &&
    inventoryItems.length === 0;
  const showInventoryDegassingNoData =
    !isInventoryDegassingLoading &&
    !inventoryDegassingError &&
    inventoryBalanceDates.length > 0 &&
    inventoryDegassingItems.length === 0;
  const showInventoryDegassingSuggestionNoData =
    !isInventoryDegassingSuggestionLoading &&
    !inventoryDegassingSuggestionError &&
    inventoryDegassingSuggestionItems.length === 0;
  const selectedDegassingFilterNomenclatureLabel = inventoryDegassingNomenclatureId
    ? sortedNomenclatureItems.find(
        (item) => String(item.nomenclature_id) === String(inventoryDegassingNomenclatureId),
      )
    : null;
  const inventorySourceContent = (
    <section className="glass-panel p-4 sm:p-5">
      <div className="space-y-4">
        <div className="w-full">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-slate-50">Остатки</h2>
            <p className="text-sm text-slate-400">
              Общий снимок складских остатков и временно недоступной части в дегазации.
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
          <section className="rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.5),rgba(10,19,29,0.6))] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">Загруженные остатки</h3>
              </div>
              <div className="text-xs text-slate-500">
                {balanceDate ? `Дата: ${balanceDate}` : "Дата остатков не выбрана"}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(220px,240px)_minmax(260px,1fr)_auto_auto]">
              <div>
                <label htmlFor="inventory-balance-date-filter" className="mb-2 block text-xs tracking-[0.08em] text-slate-500">
                  Дата остатков
                </label>
                <select
                  id="inventory-balance-date-filter"
                  value={balanceDate}
                  onChange={(event) => setBalanceDate(event.target.value)}
                  disabled={isInventoryDatesLoading || inventoryBalanceDates.length === 0}
                  className="h-10 w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {inventoryBalanceDates.length > 0 ? (
                    inventoryBalanceDates.map((optionDate, index) => (
                      <option key={optionDate} value={optionDate}>
                        {index === 0 ? `${optionDate} — последняя загрузка` : optionDate}
                      </option>
                    ))
                  ) : (
                    <option value="">Остатки ещё не загружены.</option>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="inventory-balance-search-filter" className="mb-2 block text-xs tracking-[0.08em] text-slate-500">
                  Поиск
                </label>
                <div className="flex h-10 items-center border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    id="inventory-balance-search-filter"
                    type="search"
                    value={inventorySearch}
                    onChange={(event) => setInventorySearch(event.target.value)}
                    placeholder="Поиск по коду или наименованию..."
                    className="w-full bg-transparent pl-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={handleOpenCreateInventoryForm}
                  disabled={!canEditDemandInputs || !balanceDate || isInventorySaving || deletingInventoryId !== null}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Добавить позицию
                </button>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={reloadInventoryBalance}
                  disabled={isInventoryLoading}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={["h-4 w-4", isInventoryLoading ? "animate-spin" : ""].join(" ")} />
                  Обновить
                </button>
              </div>
            </div>

            {inventoryError ? (
              <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{inventoryError}</span>
              </div>
            ) : null}
            {inventoryDatesError ? (
              <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{inventoryDatesError}</span>
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))]">
              {isInventoryLoading ? (
                <div className="px-4 py-4 text-sm text-slate-300">Загружаем данные...</div>
              ) : showInventoryNoData ? (
                <div className="px-4 py-4 text-sm text-slate-400">
                  {inventoryBalanceDates.length === 0 ? "Остатки ещё не загружены." : "За выбранную дату остатки не загружены."}
                </div>
              ) : showInventorySearchEmpty ? (
                <div className="px-4 py-4 text-sm text-slate-400">Поиск не нашёл подходящих строк.</div>
              ) : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))]">
                      <tr className="text-left">
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Номенклатура</th>
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 text-right">Общий остаток</th>
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Ед.</th>
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventoryItems.map((item) => (
                        <tr key={item.balance_id} className="border-t border-white/[0.05] transition hover:bg-cyan-300/[0.03]">
                          <td className="px-3 py-2 text-sm text-slate-200">
                            <div className="font-semibold leading-5 text-slate-100">{item.nomenclature_code || ""}</div>
                            <div className="mt-0.5 leading-5 text-slate-400">{item.nomenclature_name || ""}</div>
                          </td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-200">{formatQty(item.available_qty)}</td>
                          <td className="px-3 py-2 text-sm text-slate-300">{item.unit_of_measure || ""}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <IconActionButton
                                label="Редактировать"
                                onClick={() => handleOpenEditInventoryForm(item)}
                                disabled={!canEditDemandInputs || isInventorySaving || deletingInventoryId === item.balance_id}
                              >
                                <PencilLine className="h-3.5 w-3.5" />
                              </IconActionButton>
                              <IconActionButton
                                label="Удалить"
                                onClick={() => handleAskDeleteInventory(item)}
                                disabled={!canEditDemandInputs || isInventorySaving || deletingInventoryId === item.balance_id}
                                tone="danger"
                              >
                                {deletingInventoryId === item.balance_id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </IconActionButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-cyan-300/14 bg-cyan-400/[0.06]">
                        <td className="px-3 py-2 text-xs tracking-[0.08em] text-slate-300">Итого</td>
                        <td className="px-3 py-2 text-sm text-slate-300">Позиций: {filteredInventoryItems.length}</td>
                        <td className="px-3 py-2 text-sm text-slate-500"></td>
                        <td className="px-3 py-2 text-sm text-slate-500"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.5),rgba(10,19,29,0.6))] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-50">Из них в дегазации</h3>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>{balanceDate ? `Дата: ${balanceDate}` : "Дата остатков не выбрана"}</div>
                {selectedDegassingFilterNomenclatureLabel ? (
                  <div>
                    {selectedDegassingFilterNomenclatureLabel.nomenclature_code} — {selectedDegassingFilterNomenclatureLabel.nomenclature_name}
                  </div>
                ) : null}
              </div>
            </div>

            <input
              ref={inventoryDegassingFileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleInventoryDegassingFileChange}
            />

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(180px,210px)_minmax(220px,1fr)]">
              <div>
                <label htmlFor="inventory-degassing-date-filter" className="mb-2 block text-xs tracking-[0.08em] text-slate-500">
                  Дата остатков
                </label>
                <select
                  id="inventory-degassing-date-filter"
                  value={balanceDate}
                  onChange={(event) => setBalanceDate(event.target.value)}
                  disabled={isInventoryDatesLoading || inventoryBalanceDates.length === 0}
                  className="h-10 w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {inventoryBalanceDates.length > 0 ? (
                    inventoryBalanceDates.map((optionDate) => (
                      <option key={optionDate} value={optionDate}>
                        {optionDate}
                      </option>
                    ))
                  ) : (
                    <option value="">Сначала загрузите общие остатки</option>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="inventory-degassing-nomenclature-filter" className="mb-2 block text-xs tracking-[0.08em] text-slate-500">
                  Номенклатура
                </label>
                <select
                  id="inventory-degassing-nomenclature-filter"
                  value={inventoryDegassingNomenclatureId}
                  onChange={(event) => setInventoryDegassingNomenclatureId(event.target.value)}
                  disabled={isNomenclatureLoading || sortedNomenclatureItems.length === 0}
                  className="h-10 w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value=""></option>
                  {sortedNomenclatureItems.map((item) => (
                    <option key={item.nomenclature_id} value={item.nomenclature_id}>
                      {item.nomenclature_code} — {item.nomenclature_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <button
                type="button"
                onClick={handleOpenInventoryDegassingSuggestion}
                disabled={
                  !canEditDemandInputs ||
                  inventoryBalanceDates.length === 0 ||
                  !balanceDate ||
                  isInventoryDegassingSuggestionLoading ||
                  isInventoryDegassingSuggestionDownloading
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {isInventoryDegassingSuggestionLoading ? "Формируем..." : "Отчёт по ПФ"}
              </button>
              <button
                type="button"
                onClick={handleOpenInventoryDegassingImport}
                disabled={
                  !canEditDemandInputs ||
                  inventoryBalanceDates.length === 0 ||
                  isInventoryDegassingImporting ||
                  isInventoryDegassingImportConfirmOpen
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {isInventoryDegassingImporting ? "Импорт..." : "Импорт"}
              </button>
              <button
                type="button"
                onClick={handleDownloadInventoryDegassingTemplate}
                disabled={!canEditDemandInputs || isInventoryDegassingTemplateDownloading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {isInventoryDegassingTemplateDownloading ? "Скачивание..." : "Шаблон"}
              </button>
              <button
                type="button"
                onClick={handleOpenCreateInventoryDegassingForm}
                disabled={
                  !canEditDemandInputs ||
                  inventoryBalanceDates.length === 0 ||
                  isInventoryDegassingSaving ||
                  deletingInventoryDegassingId !== null ||
                  isInventoryDegassingImporting
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Добавить запись
              </button>
              <button
                type="button"
                onClick={reloadInventoryDegassing}
                disabled={isInventoryDegassingLoading || inventoryBalanceDates.length === 0 || isInventoryDegassingImporting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={["h-4 w-4", isInventoryDegassingLoading ? "animate-spin" : ""].join(" ")} />
                Обновить
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Импорт заменяет записи остатков в дегазации по датам, указанным в файле.
            </p>

            {inventoryDegassingImportSuccess ? (
              <div className="mt-4 flex items-start gap-3 border border-emerald-300/30 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{inventoryDegassingImportSuccess}</span>
              </div>
            ) : null}

            {inventoryDegassingImportErrors.length > 0 ? (
              <div className="mt-4 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-medium text-rose-100">
                      {inventoryDegassingImportError || "Не удалось загрузить остатки в дегазации."}
                    </div>
                    <ul className="mt-2 space-y-1 pl-5 text-rose-100/90 list-disc">
                      {inventoryDegassingImportErrors.map((message, index) => (
                        <li key={`${message}-${index}`}>{message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            {inventoryDegassingError ? (
              <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{inventoryDegassingError}</span>
              </div>
            ) : null}

            <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))]">
              {inventoryBalanceDates.length === 0 ? (
                <div className="px-4 py-4 text-sm text-slate-400">
                  Сначала загрузите общие остатки. После этого можно указать часть остатков в дегазации.
                </div>
              ) : isInventoryDegassingLoading ? (
                <div className="px-4 py-4 text-sm text-slate-300">Загружаем остатки в дегазации...</div>
              ) : showInventoryDegassingNoData ? (
                <div className="px-4 py-4 text-sm text-slate-400">Нет остатков в дегазации для выбранных условий.</div>
              ) : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))]">
                      <tr className="text-left">
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Номенклатура</th>
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 text-right">Кол-во</th>
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Доступно с</th>
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryDegassingItems.map((item) => (
                        <tr key={item.balance_degassing_id} className="border-t border-white/[0.05] transition hover:bg-cyan-300/[0.03]">
                          <td className="px-3 py-2 text-sm text-slate-200">
                            <div className="font-semibold leading-5 text-slate-100">{item.nomenclature_code || ""}</div>
                            <div className="mt-0.5 leading-5 text-slate-400">{item.nomenclature_name || ""}</div>
                            {item.comment ? (
                              <div className="mt-1 text-xs leading-4 text-slate-500">
                                Комментарий: {item.comment}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-200">
                            {formatQtyWithUnit(item.qty, item.unit_of_measure)}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-300">
                            {(() => {
                              const formatted = formatDateTimeLabel(item.available_at);
                              const parts = String(formatted).split(" ");
                              return (
                                <div className="leading-4">
                                  <div>{parts[0] || formatted}</div>
                                  {parts[1] ? <div className="mt-0.5 text-slate-500">{parts[1]}</div> : null}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <IconActionButton
                                label="Изменить"
                                onClick={() => handleOpenEditInventoryDegassingForm(item)}
                                disabled={
                                  !canEditDemandInputs ||
                                  isInventoryDegassingSaving ||
                                  deletingInventoryDegassingId === item.balance_degassing_id
                                }
                              >
                                <PencilLine className="h-3.5 w-3.5" />
                              </IconActionButton>
                              <IconActionButton
                                label="Удалить"
                                onClick={() => handleAskDeleteInventoryDegassing(item)}
                                disabled={
                                  !canEditDemandInputs ||
                                  isInventoryDegassingSaving ||
                                  deletingInventoryDegassingId === item.balance_degassing_id
                                }
                                tone="danger"
                              >
                                {deletingInventoryDegassingId === item.balance_degassing_id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </IconActionButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-cyan-300/14 bg-cyan-400/[0.06]">
                        <td className="px-3 py-2 text-xs tracking-[0.08em] text-slate-300">Итого</td>
                        <td className="px-3 py-2 text-sm text-slate-300">Позиций: {inventoryDegassingItems.length}</td>
                        <td className="px-3 py-2 text-sm text-slate-500"></td>
                        <td className="px-3 py-2 text-sm text-slate-500"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );

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

            {isInventorySourceTab ? inventorySourceContent : (
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
                        disabled={!canEditDemandInputs || isSalesPlanSaving || deletingSalesPlanId !== null}
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
                        disabled={!canEditDemandInputs || !balanceDate || isInventorySaving || deletingInventoryId !== null}
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
                        disabled={!canEditDemandInputs || isSafetyStockSaving || deletingSafetyStockId !== null}
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
                            <td className="px-3 py-2.5 text-sm font-medium text-slate-100">{item.nomenclature_code || ""}</td>
                            <td className="px-3 py-2.5 text-sm text-slate-300">{item.nomenclature_name || ""}</td>
                            <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-200">
                              {formatQty(item[currentSourceDataset.qtyKey])}
                            </td>
                            <td className="px-3 py-2.5 text-sm text-slate-300">{item.unit_of_measure || ""}</td>
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
                                        disabled={!canEditDemandInputs || isSalesPlanSaving || deletingSalesPlanId === item.sales_plan_id}
                                      >
                                        <PencilLine className="h-3.5 w-3.5" />
                                      </IconActionButton>
                                      <IconActionButton
                                        label="Удалить"
                                        onClick={() => handleAskDeleteSalesPlan(item)}
                                        disabled={!canEditDemandInputs || isSalesPlanSaving || deletingSalesPlanId === item.sales_plan_id}
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
                                          disabled={!canEditDemandInputs || isInventorySaving || deletingInventoryId === item.balance_id}
                                        >
                                          <PencilLine className="h-3.5 w-3.5" />
                                        </IconActionButton>
                                        <IconActionButton
                                          label="Удалить"
                                          onClick={() => handleAskDeleteInventory(item)}
                                          disabled={!canEditDemandInputs || isInventorySaving || deletingInventoryId === item.balance_id}
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
                                          disabled={!canEditDemandInputs || isSafetyStockSaving || deletingSafetyStockId === item.safety_stock_id}
                                        >
                                          <PencilLine className="h-3.5 w-3.5" />
                                        </IconActionButton>
                                        <IconActionButton
                                          label="Удалить"
                                          onClick={() => handleAskDeleteSafetyStock(item)}
                                          disabled={!canEditDemandInputs || isSafetyStockSaving || deletingSafetyStockId === item.safety_stock_id}
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
            )}
          </div>

          {isImportOpen ? (
            renderImportPanel()
          ) : activeSourceTab === IMPORT_CONTEXT_SALES_PLAN && isSalesPlanFormOpen && canEditDemandInputs ? (
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
                    disabled={!canEditDemandInputs || isSalesPlanSaving}
                    className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSalesPlanSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                    {isSalesPlanSaving ? "Сохраняем..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </aside>
          ) : activeSourceTab === IMPORT_CONTEXT_SAFETY_STOCK && isSafetyStockFormOpen && canEditDemandInputs ? (
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
                    disabled={!canEditDemandInputs || isSafetyStockSaving}
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
                  disabled={!canEditDemandInputs}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload className="h-4 w-4" />
                  Импорт Excel
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate(currentSourceDataset.context)}
                  disabled={!canEditDemandInputs || isTemplateDownloading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {isTemplateDownloading ? "Скачиваем..." : "Скачать шаблон"}
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

      {activeModuleTab === MODULE_TAB_SOURCE_DATA && isInventorySourceTab && isInventoryFormOpen && canEditDemandInputs ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="glass-panel w-full max-w-2xl p-5 sm:p-6">
            <div className="panel-title">
              {inventoryFormMode === "create" ? "Добавление" : "Редактирование"}
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-slate-50">
              {inventoryFormMode === "create" ? "Добавить позицию остатков" : "Редактировать остаток"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {inventoryFormMode === "create"
                ? "Заполните данные и сохраните новую строку снимка остатков."
                : "Измените доступный остаток и сохраните корректировку."}
            </p>

            <div className="panel-divider mt-5" />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Дата остатков</div>
                <input
                  type="text"
                  readOnly
                  value={balanceDate || ""}
                  className="w-full rounded-none border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                />
              </div>
              <div>
                {inventoryFormMode === "create" ? (
                  <NomenclatureSearchSelect
                    label="Номенклатура"
                    items={nomenclatureItems}
                    value={inventoryFormNomenclatureId}
                    onChange={(value) => setInventoryFormNomenclatureId(String(value))}
                    disabled={isInventorySaving || isNomenclatureLoading}
                  />
                ) : (
                  <>
                    <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Номенклатура</div>
                    <div className="space-y-1 rounded-none border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                      <div className="text-slate-100">{inventoryFormItem?.nomenclature_code}</div>
                      <div className="text-slate-300">{inventoryFormItem?.nomenclature_name}</div>
                      <div className="text-slate-500">{inventoryFormItem?.unit_of_measure}</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4">
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
              <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{inventoryFormError}</span>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
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
                disabled={!canEditDemandInputs || isInventorySaving}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isInventorySaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                {isInventorySaving ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeModuleTab === MODULE_TAB_SOURCE_DATA && isInventorySourceTab && isInventoryDegassingFormOpen && canEditDemandInputs ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="glass-panel w-full max-w-3xl p-5 sm:p-6">
            <div className="panel-title">
              {inventoryDegassingFormMode === "create" ? "Добавление" : "Редактирование"}
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-slate-50">
              {inventoryDegassingFormMode === "create" ? "Добавить запись дегазации" : "Редактировать запись дегазации"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Часть общего остатка временно исключается из доступного остатка недельного плана до даты «Доступно с».
            </p>

            <div className="panel-divider mt-5" />

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Дата остатков</div>
                {inventoryDegassingFormMode === "create" ? (
                  <select
                    value={inventoryDegassingFormAsOfDate}
                    onChange={(event) => setInventoryDegassingFormAsOfDate(event.target.value)}
                    disabled={isInventoryDegassingSaving || inventoryBalanceDates.length === 0}
                    className="h-10 w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {inventoryBalanceDates.map((optionDate) => (
                      <option key={optionDate} value={optionDate}>
                        {optionDate}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    readOnly
                    value={inventoryDegassingFormAsOfDate}
                    className="w-full rounded-none border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-slate-200"
                  />
                )}
              </div>

              <div>
                {inventoryDegassingFormMode === "create" ? (
                  <NomenclatureSearchSelect
                    label="Номенклатура"
                    items={nomenclatureItems}
                    value={inventoryDegassingFormNomenclatureId}
                    onChange={(value) => setInventoryDegassingFormNomenclatureId(String(value))}
                    disabled={isInventoryDegassingSaving || isNomenclatureLoading}
                  />
                ) : (
                  <>
                    <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Номенклатура</div>
                    <div className="space-y-1 rounded-none border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                      <div className="text-slate-100">{inventoryDegassingFormItem?.nomenclature_code}</div>
                      <div className="text-slate-300">{inventoryDegassingFormItem?.nomenclature_name}</div>
                      <div className="text-slate-500">{inventoryDegassingFormItem?.unit_of_measure}</div>
                    </div>
                  </>
                )}
              </div>

              <div>
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">
                  Количество{selectedInventoryDegassingFormNomenclature?.unit_of_measure ? `, ${selectedInventoryDegassingFormNomenclature.unit_of_measure}` : ""}
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={inventoryDegassingFormQty}
                  onChange={(event) => setInventoryDegassingFormQty(event.target.value)}
                  className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                />
              </div>

              <div>
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Дата доступности</div>
                <input
                  type="date"
                  value={inventoryDegassingFormAvailableDate}
                  onChange={(event) => setInventoryDegassingFormAvailableDate(event.target.value)}
                  className="h-10 w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                />
              </div>

              <div>
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Время доступности</div>
                <select
                  value={inventoryDegassingFormAvailableTime}
                  onChange={(event) => setInventoryDegassingFormAvailableTime(event.target.value)}
                  className="h-10 w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                >
                  <option value="07:00">07:00</option>
                  <option value="19:00">19:00</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Комментарий</div>
                <textarea
                  rows={4}
                  value={inventoryDegassingFormComment}
                  onChange={(event) => setInventoryDegassingFormComment(event.target.value)}
                  className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
                />
              </div>
            </div>

            {inventoryDegassingFormError ? (
              <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{inventoryDegassingFormError}</span>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseInventoryDegassingForm}
                disabled={isInventoryDegassingSaving}
                className="inline-flex items-center rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveInventoryDegassingForm}
                disabled={!canEditDemandInputs || isInventoryDegassingSaving}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isInventoryDegassingSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                {isInventoryDegassingSaving ? "Сохраняем..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeModuleTab === MODULE_TAB_SOURCE_DATA && isInventorySourceTab && isInventoryDegassingSuggestionOpen && canEditDemandInputs ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="glass-panel w-full max-w-6xl p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="panel-title">Отчёт по ПФ</div>
                <h3 className="mt-3 text-2xl font-semibold text-slate-50">ПФ в дегазации на начало месяца</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Проверка на 07:00 даты остатков.
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  {inventoryDegassingSuggestionMeta?.check_at
                    ? `Контрольная точка: ${formatDateTimeLabel(inventoryDegassingSuggestionMeta.check_at)}`
                    : balanceDate
                      ? `Дата остатков: ${balanceDate}`
                      : "Дата остатков не выбрана"}
                </div>
              </div>

              <div className="grid min-w-[220px] gap-3 sm:grid-cols-[120px_auto_auto]">
                <div>
                  <label className="mb-2 block text-xs tracking-[0.08em] text-slate-500">Выпуск за последние, дней</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={inventoryDegassingSuggestionLookbackDays}
                    onChange={(event) => setInventoryDegassingSuggestionLookbackDays(event.target.value)}
                    disabled={isInventoryDegassingSuggestionLoading || isInventoryDegassingSuggestionDownloading}
                    className="h-10 w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => handleLoadInventoryDegassingSuggestion(inventoryDegassingSuggestionLookbackDays)}
                    disabled={
                      !canEditDemandInputs ||
                      isInventoryDegassingSuggestionLoading ||
                      isInventoryDegassingSuggestionDownloading
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.18] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw className={["h-4 w-4", isInventoryDegassingSuggestionLoading ? "animate-spin" : ""].join(" ")} />
                    Обновить
                  </button>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => handleDownloadInventoryDegassingSuggestion(inventoryDegassingSuggestionLookbackDays)}
                    disabled={
                      !canEditDemandInputs ||
                      isInventoryDegassingSuggestionLoading ||
                      isInventoryDegassingSuggestionDownloading
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    {isInventoryDegassingSuggestionDownloading ? "Скачивание..." : "Скачать Excel для импорта"}
                  </button>
                </div>
              </div>
            </div>

            <div className="panel-divider mt-5" />

            {inventoryDegassingSuggestionErrors.length > 0 ? (
              <div className="mt-5 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-medium text-rose-100">
                      {inventoryDegassingSuggestionError || "Не удалось сформировать отчёт по ПФ в дегазации."}
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-rose-100/90">
                      {inventoryDegassingSuggestionErrors.map((message, index) => (
                        <li key={`${message}-${index}`}>{message}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-5 overflow-hidden rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))]">
              {isInventoryDegassingSuggestionLoading ? (
                <div className="px-4 py-4 text-sm text-slate-300">Формируем отчёт по ПФ...</div>
              ) : showInventoryDegassingSuggestionNoData ? (
                <div className="px-4 py-4 text-sm text-slate-400">
                  Нет ПФ, которые требуют внесения в остатки в дегазации.
                </div>
              ) : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="min-w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))]">
                      <tr className="text-left">
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Номенклатура</th>
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 text-right">Количество</th>
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Доступно с</th>
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Выпуск / смена</th>
                        <th className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryDegassingSuggestionItems.map((item, index) => (
                        <tr
                          key={`${item.nomenclature_id}-${item.available_at}-${index}`}
                          className="border-t border-white/[0.05] transition hover:bg-cyan-300/[0.03]"
                        >
                          <td className="px-3 py-2 text-sm text-slate-200">
                            <div className="font-semibold leading-5 text-slate-100">{item.nomenclature_code || ""}</div>
                            <div className="mt-0.5 leading-5 text-slate-400">{item.nomenclature_name || ""}</div>
                            {!item.has_inventory_balance ? (
                              <div className="mt-1 text-xs leading-4 text-amber-200">Нет общего остатка на дату</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-200">
                            {formatQtyWithUnit(item.actual_qty, item.unit_of_measure)}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-300">
                            {(() => {
                              const formatted = formatDateTimeLabel(item.available_at);
                              const parts = String(formatted).split(" ");
                              return (
                                <div className="leading-4">
                                  <div>{parts[0] || formatted}</div>
                                  {parts[1] ? <div className="mt-0.5 text-slate-500">{parts[1]}</div> : null}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-300">
                            {item.source_summary === "несколько фактов" ? (
                              <div className="leading-5 text-slate-300">несколько фактов</div>
                            ) : (
                              <div className="leading-5 text-slate-300">
                                {item.actual_date ? formatDateTimeLabel(`${item.actual_date} 00:00`).split(" ")[0] : "—"} / {" "}
                                {formatShiftLabel(item.shift_type)}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-300">
                            <div className="leading-5 text-slate-100">{item.status || "Будет доступен"}</div>
                            {item.has_inventory_balance ? (
                              <div className="mt-0.5 text-xs text-slate-500">
                                Общий остаток: {formatQtyWithUnit(item.inventory_balance_qty, item.unit_of_measure)}
                              </div>
                            ) : (
                              <div className="mt-0.5 text-xs text-amber-200">Сначала загрузите общий остаток</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseInventoryDegassingSuggestion}
                disabled={isInventoryDegassingSuggestionLoading || isInventoryDegassingSuggestionDownloading}
                className="inline-flex items-center rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <V2ConfirmDialog
        isOpen={Boolean(productionPlanRefreshCandidate) && isRefreshProductionPlanConfirmOpen}
        title="Обновить план выпуска из расчёта?"
        message="План выпуска будет обновлён по новому расчёту. Объёмы будут пересчитаны. Приоритеты и комментарии для совпадающих позиций сохранятся. Позиции, которых больше нет в расчёте, будут удалены."
        confirmText={isRefreshingProductionPlan ? "Обновляем..." : "Обновить план"}
        cancelText="Отмена"
        isConfirmDisabled={isRefreshingProductionPlan}
        isCancelDisabled={isRefreshingProductionPlan}
        onCancel={() => {
          if (!isRefreshingProductionPlan) {
            setIsRefreshProductionPlanConfirmOpen(false);
          }
        }}
        onConfirm={handleConfirmRefreshProductionPlan}
      />

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
        isOpen={isInventoryDegassingImportConfirmOpen && canEditDemandInputs}
        title="Загрузить файл остатков в дегазации?"
        message={
          <>
            Файл заменит текущие записи за даты, которые есть в Excel.
            <br />
            <br />
            Если за эти даты уже были строки, они будут удалены и загружены заново из файла.
          </>
        }
        confirmText={isInventoryDegassingImporting ? "Импорт..." : "Загрузить файл"}
        cancelText="Отмена"
        isConfirmDisabled={isInventoryDegassingImporting || !pendingInventoryDegassingImportFile}
        isCancelDisabled={isInventoryDegassingImporting}
        onCancel={handleCancelInventoryDegassingImport}
        onConfirm={handleConfirmInventoryDegassingImport}
      />

      <V2ConfirmDialog
        isOpen={Boolean(inventoryDegassingDeleteCandidate)}
        title="Удалить запись остатков в дегазации?"
        message="Запись будет удалена. Общий остаток на дату не изменится."
        confirmText={deletingInventoryDegassingId ? "Удаляем..." : "Удалить"}
        cancelText="Отмена"
        isConfirmDisabled={Boolean(deletingInventoryDegassingId)}
        isCancelDisabled={Boolean(deletingInventoryDegassingId)}
        onCancel={() => {
          if (!deletingInventoryDegassingId) {
            setInventoryDegassingDeleteCandidate(null);
          }
        }}
        onConfirm={handleConfirmDeleteInventoryDegassing}
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
      {inventoryDegassingDeleteError ? (
        <div className="glass-panel border-rose-300/30 bg-rose-500/[0.1] p-4 text-sm text-rose-100">
          {inventoryDegassingDeleteError}
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
                  disabled={!canCalculateDemand || isDemandCalculating}
                  className="inline-flex h-11 items-center gap-2 rounded-none border border-cyan-300/38 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/[0.2] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={["h-4 w-4", isDemandCalculating ? "animate-spin" : ""].join(" ")} />
                  {isDemandCalculating ? "Рассчитываем..." : "Рассчитать потребность"}
                </button>
                <button
                  type="button"
                  onClick={handleCreateProductionPlan}
                  disabled={
                    !canCreateProductionPlanFromDemand ||
                    !canCreateProductionPlan ||
                    isCreatingProductionPlan ||
                    isRefreshingProductionPlan
                  }
                  className="inline-flex h-11 items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingProductionPlan ? "Формируем план..." : "Сформировать план выпуска"}
                </button>
              </div>

              {canCreateProductionPlanFromDemand && demandResult && demandInternalItems.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  Нет потребности к выпуску для формирования плана.
                </p>
              ) : null}

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
            {productionPlanCreateError ? (
              <div className="glass-panel border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">{productionPlanCreateError}</div>
            ) : null}
            {productionPlanRefreshCandidate ? (
              <div className="glass-panel border-cyan-300/30 bg-cyan-500/[0.08] px-4 py-3 text-sm text-cyan-100">
                <div>План выпуска за этот месяц уже существует.</div>
                <button
                  type="button"
                  onClick={() => setIsRefreshProductionPlanConfirmOpen(true)}
                  className="mt-2 inline-flex h-9 items-center rounded-none border border-cyan-300/40 bg-cyan-400/[0.14] px-3 text-sm font-medium text-cyan-50 transition hover:bg-cyan-400/[0.22]"
                  disabled={isRefreshingProductionPlan}
                >
                  Обновить существующий план из расчёта
                </button>
              </div>
            ) : null}
            {productionPlanCreateSuccess ? (
              <div className="glass-panel border-emerald-300/30 bg-emerald-500/[0.1] px-4 py-3 text-sm text-emerald-100">{productionPlanCreateSuccess}</div>
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
                    <table className="min-w-full table-fixed text-left text-sm text-slate-200">
                      <DemandResultTableColGroup numericColumns={5} />
                      <thead className="sticky top-0 bg-[rgba(8,22,34,0.95)] text-xs uppercase tracking-[0.08em] text-slate-500"><tr><th className="px-3 py-2">Код</th><th className="px-3 py-2">Наименование</th><th className="px-3 py-2 text-center">Ед.</th><th className="px-3 py-2 text-right">План продаж</th><th className="px-3 py-2 text-right">Страховой запас</th><th className="px-3 py-2 text-right">Остаток</th><th className="px-3 py-2 text-right">Валовая потребность</th><th className="px-3 py-2 text-right">Потребность к выпуску</th></tr></thead>
                      <tbody>
                        {demandTopLevelItems.length > 0 ? demandTopLevelItems.map((item, index) => (
                          <tr key={`${item.nomenclature_code || index}-${index}`} className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]">
                            <td className="px-3 py-2.5 font-medium text-slate-100"><div className="truncate" title={item.nomenclature_code || ""}>{item.nomenclature_code || ""}</div></td>
                            <td className="px-3 py-2.5 text-slate-300"><div className="truncate" title={item.nomenclature_name || ""}>{item.nomenclature_name || ""}</div></td>
                            <td className="px-3 py-2.5 text-center text-slate-300"><div className="truncate" title={item.unit_of_measure || ""}>{item.unit_of_measure || ""}</div></td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatQty(item.sales_plan_qty)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatQty(item.safety_stock_qty)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatQty(item.available_qty)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-200">{formatQty(item.gross_demand_qty)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{formatQty(item.net_production_demand_qty)}</td>
                          </tr>
                        )) : <tr><td className="px-3 py-4 text-slate-400" colSpan={8}>Верхний спрос не сформирован.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="glass-panel p-5">
                  <div className="flex flex-wrap items-end justify-between gap-3"><h3 className="text-lg font-semibold text-slate-50">Потребность к выпуску</h3><div className="text-sm text-slate-400">Позиций: <span className="tabular-nums text-slate-100">{demandInternalItems.length}</span></div></div>
                  <div className="mt-4 max-h-[360px] overflow-auto border border-cyan-300/10">
                    <table className="min-w-full table-fixed text-left text-sm text-slate-200">
                      <DemandResultTableColGroup numericColumns={1} />
                      <thead className="sticky top-0 bg-[rgba(8,22,34,0.95)] text-xs uppercase tracking-[0.08em] text-slate-500"><tr><th className="px-3 py-2">Код</th><th className="px-3 py-2">Наименование</th><th className="px-3 py-2 text-center">Ед.</th><th className="px-3 py-2 text-right">Количество к выпуску</th></tr></thead>
                      <tbody>
                        {demandInternalItems.length > 0 ? demandInternalItems.map((item, index) => (
                          <tr key={`${item.nomenclature_code || index}-${index}`} className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]">
                            <td className="px-3 py-2.5 font-medium text-slate-100"><div className="truncate" title={item.nomenclature_code || ""}>{item.nomenclature_code || ""}</div></td>
                            <td className="px-3 py-2.5 text-slate-300"><div className="truncate" title={item.nomenclature_name || ""}>{item.nomenclature_name || ""}</div></td>
                            <td className="px-3 py-2.5 text-center text-slate-300"><div className="truncate" title={item.unit_of_measure || ""}>{item.unit_of_measure || ""}</div></td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{formatQty(item.required_qty)}</td>
                          </tr>
                        )) : <tr><td className="px-3 py-4 text-slate-400" colSpan={4}>Потребность к выпуску не сформирована.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="glass-panel p-5">
                  <div className="flex flex-wrap items-end justify-between gap-3"><h3 className="text-lg font-semibold text-slate-50">Внешнее обеспечение</h3><div className="text-sm text-slate-400">Позиций: <span className="tabular-nums text-slate-100">{demandExternalItems.length}</span></div></div>
                  <div className="mt-4 max-h-[360px] overflow-auto border border-cyan-300/10">
                    <table className="min-w-full table-fixed text-left text-sm text-slate-200">
                      <DemandResultTableColGroup numericColumns={1} />
                      <thead className="sticky top-0 bg-[rgba(8,22,34,0.95)] text-xs uppercase tracking-[0.08em] text-slate-500"><tr><th className="px-3 py-2">Код</th><th className="px-3 py-2">Наименование</th><th className="px-3 py-2 text-center">Ед.</th><th className="px-3 py-2 text-right">Количество</th></tr></thead>
                      <tbody>
                        {demandExternalItems.length > 0 ? demandExternalItems.map((item, index) => (
                          <tr key={`${item.nomenclature_code || index}-${index}`} className="border-t border-white/[0.05] hover:bg-cyan-300/[0.03]">
                            <td className="px-3 py-2.5 font-medium text-slate-100"><div className="truncate" title={item.nomenclature_code || ""}>{item.nomenclature_code || ""}</div></td>
                            <td className="px-3 py-2.5 text-slate-300"><div className="truncate" title={item.nomenclature_name || ""}>{item.nomenclature_name || ""}</div></td>
                            <td className="px-3 py-2.5 text-center text-slate-300"><div className="truncate" title={item.unit_of_measure || ""}>{item.unit_of_measure || ""}</div></td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-100">{formatQty(item.required_qty)}</td>
                          </tr>
                        )) : <tr><td className="px-3 py-4 text-slate-400" colSpan={4}>Внешнее обеспечение не сформировано.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={["glass-panel p-5", demandProblemItems.length > 0 ? "border-amber-300/30 bg-amber-400/[0.05]" : ""].join(" ")}>
                  <h3 className="text-lg font-semibold text-slate-50">Проблемы расчёта</h3>
                  {demandProblemItems.length > 0 ? (
                    <div className="mt-4 max-h-[320px] overflow-auto border border-amber-300/20">
                      <table className="min-w-full text-left text-sm text-slate-200">
                        <thead className="sticky top-0 bg-[rgba(24,20,10,0.55)] text-xs uppercase tracking-[0.08em] text-amber-100/70"><tr><th className="px-3 py-2">Код проблемы</th><th className="px-3 py-2">Сообщение</th><th className="px-3 py-2">Номенклатура</th><th className="px-3 py-2">Маршрут</th><th className="px-3 py-2">Детали</th></tr></thead>
                        <tbody>
                          {demandProblemItems.map((problem, index) => (
                            <tr key={`${problem.problem_code || "problem"}-${index}`} className="border-t border-white/[0.05]">
                              <td className="px-3 py-2.5 font-medium text-amber-50">{problem.problem_code || ""}</td>
                              <td className="px-3 py-2.5 text-slate-200">{problem.message || ""}</td>
                              <td className="px-3 py-2.5 text-slate-300">{problem.nomenclature_code || ""}</td>
                              <td className="px-3 py-2.5 tabular-nums text-slate-300">{problem.route_id ?? ""}</td>
                              <td className="px-3 py-2.5 text-slate-300">{problem.details ? JSON.stringify(problem.details) : ""}</td>
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
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Дата остатков</span><span className="font-medium text-slate-100">{balanceDate || "не выбрана"}</span></div>
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
                  <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Внешнее обеспечение</span><span className="font-medium tabular-nums text-slate-100">{demandExternalItems.length}</span></div>
                  <div className="flex items-center justify-between gap-3"><span className={demandProblemItems.length > 0 ? "text-amber-200" : "text-slate-500"}>Проблемы</span><span className={["font-medium tabular-nums", demandProblemItems.length > 0 ? "text-amber-100" : "text-emerald-100"].join(" ")}>{demandProblemItems.length}</span></div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Расчёт ещё не выполнен.</p>
              )}
            </div>

            <div className="mt-4 rounded-none border border-white/8 bg-white/[0.025] px-4 py-4">
              <div className="text-sm font-medium text-slate-100">Статус</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-slate-500">Последний расчёт</span><span className="font-medium text-slate-100">{lastCalculatedAt ? new Date(lastCalculatedAt).toLocaleString("ru-RU") : "нет"}</span></div>
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

            <div className="mt-4 rounded-none border border-white/8 bg-white/[0.025] px-4 py-4">
              <div className="text-sm font-medium text-slate-100">Подсказка</div>
              <p className="mt-2 text-sm text-slate-400">
                План выпуска формируется из строк “Потребность к выпуску”.
              </p>
            </div>
          </aside>
        </section>
      ) : null}

    </section>
  );
}

export default DemandSection;



