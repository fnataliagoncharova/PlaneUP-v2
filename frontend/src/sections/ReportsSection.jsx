import { AlertCircle, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import InventoryBalanceImportPanel from "../components/reports/InventoryBalanceImportPanel";
import SafetyStockImportPanel from "../components/reports/SafetyStockImportPanel";
import SalesPlanImportPanel from "../components/reports/SalesPlanImportPanel";
import {
  commitInventoryBalanceImport,
  getInventoryBalanceImportTemplateUrl,
  getInventoryBalanceList,
  previewInventoryBalanceImport,
} from "../services/inventoryBalanceApi";
import {
  commitSafetyStockImport,
  getSafetyStockImportTemplateUrl,
  getSafetyStockList,
  previewSafetyStockImport,
} from "../services/safetyStockApi";
import {
  commitSalesPlanImport,
  getSalesPlanImportTemplateUrl,
  getSalesPlanList,
  previewSalesPlanImport,
} from "../services/salesPlanApi";

const IMPORT_CONTEXT_SALES_PLAN = "sales_plan";
const IMPORT_CONTEXT_INVENTORY_BALANCE = "inventory_balance";
const IMPORT_CONTEXT_SAFETY_STOCK = "safety_stock";

function getCurrentDateValue() {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  const localDate = new Date(now.getTime() - timezoneOffsetMs);
  return localDate.toISOString().slice(0, 10);
}

function formatQty(value) {
  if (value === null || value === undefined) {
    return "—";
  }
  return value;
}

function ReportsSection() {
  const [planDate, setPlanDate] = useState(getCurrentDateValue);
  const [salesPlanItems, setSalesPlanItems] = useState([]);
  const [isSalesPlanLoading, setIsSalesPlanLoading] = useState(true);
  const [salesPlanError, setSalesPlanError] = useState("");

  const [balanceDate, setBalanceDate] = useState(getCurrentDateValue);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [isInventoryLoading, setIsInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState("");

  const [safetyStockItems, setSafetyStockItems] = useState([]);
  const [isSafetyStockLoading, setIsSafetyStockLoading] = useState(true);
  const [safetyStockError, setSafetyStockError] = useState("");

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importContext, setImportContext] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [importError, setImportError] = useState("");
  const [importErrorContext, setImportErrorContext] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isCommitLoading, setIsCommitLoading] = useState(false);

  const reloadSalesPlan = useCallback(async () => {
    setIsSalesPlanLoading(true);
    setSalesPlanError("");

    try {
      const response = await getSalesPlanList(planDate);
      setSalesPlanItems(Array.isArray(response) ? response : []);
    } catch (error) {
      setSalesPlanItems([]);
      setSalesPlanError(error.message || "Не удалось загрузить план продаж.");
    } finally {
      setIsSalesPlanLoading(false);
    }
  }, [planDate]);

  const reloadInventoryBalance = useCallback(async () => {
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
    reloadInventoryBalance();
  }, [reloadInventoryBalance]);

  useEffect(() => {
    reloadSafetyStock();
  }, [reloadSafetyStock]);

  const hasSalesPlanRows = salesPlanItems.length > 0;
  const hasInventoryRows = inventoryItems.length > 0;
  const hasSafetyStockRows = safetyStockItems.length > 0;

  const totalPlanQty = useMemo(
    () => salesPlanItems.reduce((accumulator, item) => accumulator + Number(item.plan_qty || 0), 0),
    [salesPlanItems],
  );

  const totalBalanceQty = useMemo(
    () => inventoryItems.reduce((accumulator, item) => accumulator + Number(item.available_qty || 0), 0),
    [inventoryItems],
  );

  const totalSafetyStockQty = useMemo(
    () => safetyStockItems.reduce((accumulator, item) => accumulator + Number(item.stock_qty || 0), 0),
    [safetyStockItems],
  );

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

  const showSalesImportError =
    importError && !isImportOpen && importErrorContext === IMPORT_CONTEXT_SALES_PLAN;
  const showInventoryImportError =
    importError && !isImportOpen && importErrorContext === IMPORT_CONTEXT_INVENTORY_BALANCE;
  const showSafetyStockImportError =
    importError && !isImportOpen && importErrorContext === IMPORT_CONTEXT_SAFETY_STOCK;

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(0,0.88fr)] 2xl:grid-cols-[minmax(0,1.24fr)_minmax(0,0.92fr)]">
      <div className="space-y-6">
        <header className="glass-panel p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="font-['Space_Grotesk'] text-3xl font-semibold text-slate-50 sm:text-4xl">
                Исходные данные спроса
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                Загружайте план продаж, остатки и страховой запас из Excel с предпросмотром перед подтверждением.
              </p>
            </div>
          </div>
        </header>

        <section className="glass-panel p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h2 className="font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">План продаж</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Загрузите файл плана продаж для выбранной даты.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenImportPanel(IMPORT_CONTEXT_SALES_PLAN)}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
              >
                <Upload className="h-4 w-4" />
                Импорт Excel
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate(IMPORT_CONTEXT_SALES_PLAN)}
                className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Скачать шаблон Excel
              </button>
            </div>
          </div>

          {showSalesImportError ? (
            <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{importError}</span>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full max-w-[280px]">
              <label
                htmlFor="sales-plan-date"
                className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500"
              >
                Дата плана
              </label>
              <input
                id="sales-plan-date"
                type="date"
                value={planDate}
                onChange={(event) => setPlanDate(event.target.value)}
                className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
              />
            </div>

            <div className="text-sm text-slate-300">
              {hasSalesPlanRows ? `Всего позиций: ${salesPlanItems.length}` : "Нет данных за выбранную дату"}
            </div>
          </div>

          {salesPlanError ? (
            <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{salesPlanError}</span>
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))]">
            {isSalesPlanLoading ? (
              <div className="px-4 py-4 text-sm text-slate-300">Загружаем данные...</div>
            ) : !hasSalesPlanRows ? (
              <div className="px-4 py-4 text-sm text-slate-400">За выбранную дату план продаж не загружен.</div>
            ) : (
              <div className="max-h-[320px] overflow-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-white/[0.03] text-left">
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Код
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Наименование
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Количество
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Ед.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesPlanItems.map((item) => (
                      <tr key={item.sales_plan_id} className="border-t border-white/[0.05]">
                        <td className="px-3 py-2 text-sm text-slate-100">{item.nomenclature_code}</td>
                        <td className="px-3 py-2 text-sm text-slate-200">{item.nomenclature_name}</td>
                        <td className="px-3 py-2 text-sm text-slate-200">{formatQty(item.plan_qty)}</td>
                        <td className="px-3 py-2 text-sm text-slate-300">{item.unit_of_measure}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-cyan-300/14 bg-cyan-400/[0.06]">
                      <td className="px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-400" colSpan={2}>
                        Итого
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-cyan-50">{totalPlanQty.toFixed(3)}</td>
                      <td className="px-3 py-2 text-sm text-slate-400">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="glass-panel p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h2 className="font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">Остатки</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Импортируйте доступные остатки по номенклатурам для расчёта потребности.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenImportPanel(IMPORT_CONTEXT_INVENTORY_BALANCE)}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
              >
                <Upload className="h-4 w-4" />
                Импорт Excel
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate(IMPORT_CONTEXT_INVENTORY_BALANCE)}
                className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Скачать шаблон Excel
              </button>
            </div>
          </div>

          {showInventoryImportError ? (
            <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{importError}</span>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full max-w-[280px]">
              <label
                htmlFor="inventory-balance-date"
                className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-500"
              >
                Дата остатка
              </label>
              <input
                id="inventory-balance-date"
                type="date"
                value={balanceDate}
                onChange={(event) => setBalanceDate(event.target.value)}
                className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-300/45"
              />
            </div>

            <div className="text-sm text-slate-300">
              {hasInventoryRows ? `Всего позиций: ${inventoryItems.length}` : "Нет данных за выбранную дату"}
            </div>
          </div>

          {inventoryError ? (
            <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{inventoryError}</span>
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))]">
            {isInventoryLoading ? (
              <div className="px-4 py-4 text-sm text-slate-300">Загружаем данные...</div>
            ) : !hasInventoryRows ? (
              <div className="px-4 py-4 text-sm text-slate-400">За выбранную дату остатки не загружены.</div>
            ) : (
              <div className="max-h-[320px] overflow-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-white/[0.03] text-left">
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Код
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Наименование
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Доступный остаток
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Ед.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryItems.map((item) => (
                      <tr key={item.balance_id} className="border-t border-white/[0.05]">
                        <td className="px-3 py-2 text-sm text-slate-100">{item.nomenclature_code}</td>
                        <td className="px-3 py-2 text-sm text-slate-200">{item.nomenclature_name}</td>
                        <td className="px-3 py-2 text-sm text-slate-200">{formatQty(item.available_qty)}</td>
                        <td className="px-3 py-2 text-sm text-slate-300">{item.unit_of_measure}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-cyan-300/14 bg-cyan-400/[0.06]">
                      <td className="px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-400" colSpan={2}>
                        Итого
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-cyan-50">{totalBalanceQty.toFixed(3)}</td>
                      <td className="px-3 py-2 text-sm text-slate-400">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="glass-panel p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h2 className="font-['Space_Grotesk'] text-2xl font-semibold text-slate-50">Страховой запас</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Импортируйте целевой страховой запас по номенклатурам для расчёта потребности.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenImportPanel(IMPORT_CONTEXT_SAFETY_STOCK)}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
              >
                <Upload className="h-4 w-4" />
                Импорт Excel
              </button>
              <button
                type="button"
                onClick={() => handleDownloadTemplate(IMPORT_CONTEXT_SAFETY_STOCK)}
                className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Скачать шаблон Excel
              </button>
            </div>
          </div>

          {showSafetyStockImportError ? (
            <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{importError}</span>
            </div>
          ) : null}

          <div className="mt-4 text-sm text-slate-300">
            {hasSafetyStockRows ? `Всего позиций: ${safetyStockItems.length}` : "Нет данных по страховому запасу"}
          </div>

          {safetyStockError ? (
            <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{safetyStockError}</span>
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))]">
            {isSafetyStockLoading ? (
              <div className="px-4 py-4 text-sm text-slate-300">Загружаем данные...</div>
            ) : !hasSafetyStockRows ? (
              <div className="px-4 py-4 text-sm text-slate-400">Страховой запас пока не загружен.</div>
            ) : (
              <div className="max-h-[320px] overflow-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-white/[0.03] text-left">
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Код
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Наименование
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Страховой запас
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Ед.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {safetyStockItems.map((item) => (
                      <tr key={item.safety_stock_id} className="border-t border-white/[0.05]">
                        <td className="px-3 py-2 text-sm text-slate-100">{item.nomenclature_code}</td>
                        <td className="px-3 py-2 text-sm text-slate-200">{item.nomenclature_name}</td>
                        <td className="px-3 py-2 text-sm text-slate-200">{formatQty(item.stock_qty)}</td>
                        <td className="px-3 py-2 text-sm text-slate-300">{item.unit_of_measure}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-cyan-300/14 bg-cyan-400/[0.06]">
                      <td className="px-3 py-2 text-xs uppercase tracking-[0.14em] text-slate-400" colSpan={2}>
                        Итого
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-cyan-50">
                        {totalSafetyStockQty.toFixed(3)}
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-400">—</td>
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
      ) : (
        <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
          <div className="panel-title">Импорт данных</div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            Загрузка из Excel
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Сначала выполняйте предпросмотр, затем подтверждайте импорт.
          </p>

          <div className="panel-divider mt-5" />

          <div className="mt-6 space-y-4">
            <div className="rounded-none border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(18,76,97,0.2),rgba(8,28,40,0.72))] px-4 py-4">
              <div className="flex items-center gap-3 text-cyan-100">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="text-sm font-medium">План продаж</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Количество должно быть указано в единице измерения номенклатуры, заведённой в системе.
              </p>
            </div>

            <div className="rounded-none border border-amber-300/24 bg-amber-400/[0.08] px-4 py-4">
              <div className="flex items-center gap-3 text-amber-100">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="text-sm font-medium">Остатки</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Остаток должен быть указан в единице измерения номенклатуры, заведённой в системе.
              </p>
            </div>

            <div className="rounded-none border border-lime-300/24 bg-lime-400/[0.08] px-4 py-4">
              <div className="flex items-center gap-3 text-lime-100">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="text-sm font-medium">Страховой запас</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Страховой запас должен быть указан в единице измерения номенклатуры, заведённой в системе.
              </p>
            </div>
          </div>
        </aside>
      )}
    </section>
  );
}

export default ReportsSection;
