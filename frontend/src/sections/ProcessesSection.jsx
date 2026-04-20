import { PencilLine, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import ProcessDetailsPanel from "../components/processes/ProcessDetailsPanel";
import ProcessesList from "../components/processes/ProcessesList";
import { demoProcesses } from "../data/demoProcesses";

const defaultSelectedId =
  demoProcesses.find((item) => item.code === "PR-002")?.id ?? demoProcesses[0].id;

function ProcessesSection() {
  const [selectedItemId, setSelectedItemId] = useState(defaultSelectedId);
  const [searchValue, setSearchValue] = useState("");

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return demoProcesses;
    }

    return demoProcesses.filter((item) => {
      const codeMatches = item.code.toLowerCase().includes(normalizedSearch);
      const nameMatches = item.name.toLowerCase().includes(normalizedSearch);

      return codeMatches || nameMatches;
    });
  }, [searchValue]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      return;
    }

    const hasSelectedItem = filteredItems.some((item) => item.id === selectedItemId);

    if (!hasSelectedItem) {
      setSelectedItemId(filteredItems[0].id);
    }
  }, [filteredItems, selectedItemId]);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedItemId) ??
    demoProcesses.find((item) => item.id === selectedItemId) ??
    null;

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(0,0.88fr)] 2xl:grid-cols-[minmax(0,1.24fr)_minmax(0,0.92fr)]">
      <div className="space-y-6">
        <header className="glass-panel p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="font-['Space_Grotesk'] text-3xl font-semibold text-slate-50 sm:text-4xl">
                Технологические операции
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                Справочник технологических операций V2: процессы связывают маршруты, шаги и
                оборудование в единую производственную логику. Экран продолжает тот же
                Industrial Flow UI язык, что и уже утверждённые разделы маршрутов и
                номенклатуры.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
              >
                <Plus className="h-4 w-4" />
                Новый процесс
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-none border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.07]"
              >
                <PencilLine className="h-4 w-4" />
                Редактировать
              </button>
            </div>
          </div>
        </header>

        <ProcessesList
          items={filteredItems}
          selectedItemId={selectedItem?.id ?? null}
          onSelectItem={setSelectedItemId}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />
      </div>

      <ProcessDetailsPanel item={filteredItems.length > 0 ? selectedItem : null} />
    </section>
  );
}

export default ProcessesSection;
