import { AlertCircle, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import NomenclatureDetailsPanel from "../components/nomenclature/NomenclatureDetailsPanel";
import NomenclatureFormPanel from "../components/nomenclature/NomenclatureFormPanel";
import NomenclatureList from "../components/nomenclature/NomenclatureList";
import {
  createNomenclatureItem,
  getNomenclatureList,
  updateNomenclatureItem,
} from "../services/nomenclatureApi";

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

function NomenclatureSection() {
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");

  useEffect(() => {
    let isCancelled = false;

    async function loadNomenclature() {
      setIsLoading(true);
      setLoadError("");

      try {
        const response = await getNomenclatureList();

        if (isCancelled) {
          return;
        }

        const sortedItems = sortByCode(response);
        setItems(sortedItems);
        setSelectedItemId(getDefaultSelection(sortedItems));
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

    loadNomenclature();

    return () => {
      isCancelled = true;
    };
  }, []);

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

  const handleOpenCreateForm = () => {
    setFormMode("create");
    setSaveError("");
    setIsFormOpen(true);
  };

  const handleOpenEditForm = () => {
    if (!selectedItem) {
      return;
    }

    setFormMode("edit");
    setSaveError("");
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
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                Единый справочник производственных позиций V2. Раздел работает на реальном backend API
                и поддерживает создание и редактирование карточек напрямую из интерфейса.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleOpenCreateForm}
                className="inline-flex items-center gap-2 rounded-none border border-cyan-400/30 bg-cyan-400/14 px-4 py-2.5 text-sm font-medium text-cyan-50 shadow-cyanGlow transition hover:bg-cyan-400/18"
              >
                <Plus className="h-4 w-4" />
                Новая позиция
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

      {isFormOpen ? (
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
        />
      )}
    </section>
  );
}

export default NomenclatureSection;
