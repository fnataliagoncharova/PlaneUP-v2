import { Download, FileSpreadsheet, RefreshCw, Save, Upload, X } from "lucide-react";

function getPreviewStatusLabel(status) {
  if (status === "new") {
    return "Новая";
  }
  if (status === "update") {
    return "Будет обновлена";
  }
  if (status === "conflict") {
    return "Конфликт";
  }
  return "Ошибка";
}

function getPreviewStatusClassName(status) {
  if (status === "new") {
    return "border-cyan-200/24 bg-cyan-300/10 text-cyan-100/85";
  }
  if (status === "update") {
    return "border-emerald-200/24 bg-emerald-300/[0.12] text-emerald-100/85";
  }
  if (status === "conflict") {
    return "border-amber-200/24 bg-amber-300/[0.14] text-amber-100/85";
  }
  return "border-rose-200/24 bg-rose-500/[0.16] text-rose-100/85";
}

function boolToLabel(value) {
  if (value === true) {
    return "Да";
  }

  if (value === false) {
    return "Нет";
  }

  return "—";
}

function NomenclatureImportPanel({
  importMode,
  selectedFile,
  previewData,
  commitResult,
  errorMessage,
  isPreviewLoading,
  isCommitLoading,
  onImportModeChange,
  onFileChange,
  onPreview,
  onCommit,
  onCancel,
  onDownloadTemplate,
  isTemplateDownloading,
}) {
  const canRunPreview = selectedFile && !isPreviewLoading && !isCommitLoading;
  const canRunCommit = selectedFile && previewData && !isPreviewLoading && !isCommitLoading;

  return (
    <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="panel-title">Импорт Excel</div>
          <h2 className="mt-3 font-['Space_Grotesk'] text-3xl font-semibold text-slate-50">
            Импорт номенклатуры
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Загрузите файл `.xlsx`, проверьте предпросмотр и подтвердите импорт.
          </p>
        </div>
      </div>

      <div className="panel-divider mt-5" />

      <div className="mt-6 space-y-5">
        <div className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
            Режим импорта
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onImportModeChange("add_only")}
              disabled={isPreviewLoading || isCommitLoading}
              className={[
                "rounded-none border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-60",
                importMode === "add_only"
                  ? "border-cyan-300/35 bg-cyan-300/16 text-cyan-50"
                  : "border-white/12 bg-white/[0.04] text-slate-300 hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]",
              ].join(" ")}
            >
              Добавить новые
            </button>
            <button
              type="button"
              onClick={() => onImportModeChange("upsert")}
              disabled={isPreviewLoading || isCommitLoading}
              className={[
                "rounded-none border px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-60",
                importMode === "upsert"
                  ? "border-cyan-300/35 bg-cyan-300/16 text-cyan-50"
                  : "border-white/12 bg-white/[0.04] text-slate-300 hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]",
              ].join(" ")}
            >
              Добавить и обновить
            </button>
          </div>
        </div>

        <div className="block">
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
            Excel файл
          </div>
          <label className="flex cursor-pointer items-center gap-3 border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] px-4 py-3.5 transition hover:border-cyan-200/30">
            <FileSpreadsheet className="h-4 w-4 text-cyan-100" />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
              {selectedFile?.name || "Выберите файл .xlsx"}
            </span>
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              disabled={isPreviewLoading || isCommitLoading}
            />
          </label>
          <div className="mt-2 text-xs text-slate-500">
            Поддерживается формат `.xlsx`.
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onDownloadTemplate}
            disabled={isTemplateDownloading || isPreviewLoading || isCommitLoading}
            className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-3.5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            {isTemplateDownloading ? "Скачиваем..." : "Скачать шаблон Excel"}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onPreview}
              disabled={!canRunPreview}
              className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-3.5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5" />
              {isPreviewLoading ? "Проверяем..." : "Предпросмотр"}
            </button>
            <button
              type="button"
              onClick={onCommit}
              disabled={!canRunCommit}
              className="inline-flex items-center gap-2 rounded-none border border-emerald-300/35 bg-emerald-300/[0.18] px-3.5 py-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-50 transition hover:bg-emerald-300/[0.24] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCommitLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isCommitLoading ? "Импортируем..." : "Подтвердить импорт"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        {previewData ? (
          <div className="space-y-4">
            <div className="border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))] px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Предпросмотр</div>
              <div className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
                <div>Строк: {previewData.total_rows}</div>
                <div>Валидных: {previewData.valid_rows}</div>
                <div>Новых: {previewData.new_rows}</div>
                <div>Обновлений: {previewData.update_rows}</div>
                <div>Конфликтов: {previewData.conflict_rows}</div>
                <div>Ошибок: {previewData.error_rows}</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-none border border-cyan-300/10 bg-[linear-gradient(180deg,rgba(17,31,43,0.72),rgba(10,19,29,0.76))]">
              <div className="max-h-[320px] overflow-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-white/[0.03] text-left">
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Строка
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Код
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Наименование
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Ед.
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Активность
                      </th>
                      <th className="px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                        Статус
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row) => (
                      <tr key={row.row_no} className="border-t border-white/[0.05]">
                        <td className="px-3 py-2 align-top text-sm text-slate-300">{row.row_no}</td>
                        <td className="px-3 py-2 align-top text-sm text-slate-100">
                          {row.nomenclature_code || "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-sm text-slate-200">
                          {row.nomenclature_name || "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-sm text-slate-300">
                          <div>{row.unit_of_measure || "—"}</div>
                          {row.unit_normalized_from ? (
                            <div className="mt-1 text-xs text-cyan-100/75">
                              из: {row.unit_normalized_from}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 align-top text-sm text-slate-300">
                          {boolToLabel(row.is_active)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div
                            className={[
                              "inline-flex border px-2 py-1 text-[11px] uppercase tracking-[0.14em]",
                              getPreviewStatusClassName(row.status),
                            ].join(" ")}
                          >
                            {getPreviewStatusLabel(row.status)}
                          </div>
                          {row.messages?.length ? (
                            <div className="mt-1 text-xs text-slate-400">
                              {row.messages.join("; ")}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {commitResult ? (
          <div className="border border-emerald-300/30 bg-emerald-500/[0.08] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/80">
              Результат импорта
            </div>
            <div className="mt-3 grid gap-2 text-sm text-emerald-100 sm:grid-cols-2">
              <div>Создано: {commitResult.created_count}</div>
              <div>Обновлено: {commitResult.updated_count}</div>
              <div>Пропущено: {commitResult.skipped_count}</div>
              <div>Ошибок: {commitResult.error_count}</div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPreviewLoading || isCommitLoading}
            className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            Закрыть
          </button>
        </div>
      </div>
    </aside>
  );
}

export default NomenclatureImportPanel;
