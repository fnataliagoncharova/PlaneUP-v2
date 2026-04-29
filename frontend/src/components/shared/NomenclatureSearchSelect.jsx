import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getOptionLabel(item) {
  const typeLabel = item.item_type === "purchased" ? "Закупаемая" : "Производимая";
  return `${item.nomenclature_code} — ${item.nomenclature_name} (${typeLabel})`;
}

function NomenclatureSearchSelect({
  label,
  items,
  value,
  onChange,
  placeholder = "Код или название номенклатуры",
  disabled = false,
  maxVisibleOptions = 8,
}) {
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputWrapperRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 288,
    placement: "bottom",
  });

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) =>
        left.nomenclature_code.localeCompare(right.nomenclature_code, "ru"),
      ),
    [items],
  );

  const normalizedValue = Number(value);
  const selectedItem = sortedItems.find((item) => item.nomenclature_id === normalizedValue);

  useEffect(() => {
    if (isOpen) {
      return;
    }
    setQuery(selectedItem ? getOptionLabel(selectedItem) : "");
  }, [isOpen, selectedItem]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event) => {
      const clickedInsideTrigger = containerRef.current?.contains(event.target);
      const clickedInsideDropdown = dropdownRef.current?.contains(event.target);
      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return sortedItems.slice(0, maxVisibleOptions);
    }

    return sortedItems
      .filter((item) => {
        const codeMatches = normalizeText(item.nomenclature_code).includes(normalizedQuery);
        const nameMatches = normalizeText(item.nomenclature_name).includes(normalizedQuery);
        return codeMatches || nameMatches;
      })
      .slice(0, maxVisibleOptions);
  }, [maxVisibleOptions, query, sortedItems]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, isOpen]);

  const updateDropdownPosition = useCallback(() => {
    if (!inputWrapperRef.current) {
      return;
    }

    const rect = inputWrapperRef.current.getBoundingClientRect();
    const viewportPadding = 8;
    const spacing = 6;
    const preferredMaxHeight = 288;
    const availableBelow = window.innerHeight - rect.bottom - spacing - viewportPadding;
    const availableAbove = rect.top - spacing - viewportPadding;
    const placeAbove = availableBelow < 200 && availableAbove > availableBelow;
    const maxHeight = Math.max(140, Math.min(preferredMaxHeight, placeAbove ? availableAbove : availableBelow));
    const top = placeAbove ? Math.max(viewportPadding, rect.top - spacing - maxHeight) : rect.bottom + spacing;

    setDropdownPosition({
      left: rect.left,
      top,
      width: rect.width,
      maxHeight,
      placement: placeAbove ? "top" : "bottom",
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    document.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      document.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  const handleSelect = (item) => {
    onChange(item.nomenclature_id);
    setQuery(getOptionLabel(item));
    setIsOpen(false);
  };

  const handleInputKeyDown = (event) => {
    if (!isOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((previousIndex) =>
        filteredItems.length === 0 ? 0 : Math.min(previousIndex + 1, filteredItems.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((previousIndex) => Math.max(previousIndex - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (filteredItems.length === 0) {
        return;
      }
      event.preventDefault();
      handleSelect(filteredItems[highlightedIndex] ?? filteredItems[0]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="block" ref={containerRef}>
      <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="relative" ref={inputWrapperRef}>
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) {
              updateDropdownPosition();
              setIsOpen(true);
            }
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            updateDropdownPosition();
            setIsOpen(true);
          }}
          onKeyDown={handleInputKeyDown}
          className="w-full rounded-none border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,30,43,0.76),rgba(9,17,27,0.9))] py-3.5 pl-10 pr-4 text-base leading-6 text-slate-100 outline-none transition focus:border-cyan-200/40 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {isOpen
        ? createPortal(
            <div
              ref={dropdownRef}
              className={[
                "fixed z-[120] overflow-y-auto border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(8,18,28,0.98),rgba(6,13,22,0.98))] shadow-[0_16px_38px_rgba(2,8,20,0.58)]",
                dropdownPosition.placement === "top" ? "origin-bottom" : "origin-top",
              ].join(" ")}
              style={{
                left: dropdownPosition.left,
                top: dropdownPosition.top,
                width: dropdownPosition.width,
                maxHeight: dropdownPosition.maxHeight,
              }}
            >
              {filteredItems.length > 0 ? (
                filteredItems.map((option, index) => {
                  const isHighlighted = index === highlightedIndex;
                  const isSelected = option.nomenclature_id === normalizedValue;

                  return (
                    <button
                      key={option.nomenclature_id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelect(option)}
                      className={[
                        "flex w-full flex-col gap-1 border-b border-white/[0.04] px-4 py-3 text-left transition last:border-b-0",
                        isHighlighted || isSelected
                          ? "bg-cyan-400/[0.14] text-cyan-50"
                          : "text-slate-200 hover:bg-cyan-400/[0.08]",
                      ].join(" ")}
                    >
                      <span className="text-sm font-medium">{getOptionLabel(option)}</span>
                      <span className="text-xs uppercase tracking-[0.14em] text-slate-400">{option.unit_of_measure}</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-sm text-slate-400">Ничего не найдено.</div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default NomenclatureSearchSelect;
