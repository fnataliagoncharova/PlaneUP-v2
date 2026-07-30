import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useState } from "react";

import PlaneUpLogo from "../common/PlaneUpLogo";

function Sidebar({
  items,
  activeSection,
  onSelect,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) {
  const groups = items?.[0]?.items ? items : [{ label: "", items }];
  const [openGroups, setOpenGroups] = useState(() => ({
    Справочники: true,
  }));

  const toggleGroup = (groupLabel) => {
    setOpenGroups((currentGroups) => ({
      ...currentGroups,
      [groupLabel]: currentGroups[groupLabel] === false,
    }));
  };

  const handleSelect = (sectionId) => {
    onSelect(sectionId);
  };

  return (
    <>
      <div
        className={[
          "fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition lg:hidden",
          isMobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 h-dvh w-[292px] max-w-[85vw] border-r border-cyan-300/10 bg-[linear-gradient(180deg,rgba(8,18,29,0.98),rgba(9,20,31,0.95)_55%,rgba(7,15,24,0.98))] transition-transform duration-300 lg:static lg:z-auto lg:h-auto lg:max-w-none lg:translate-x-0 lg:border-b-0 lg:border-r lg:transition-[width]",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed ? "lg:w-[104px]" : "lg:w-[292px]",
        ].join(" ")}
      >
        <div className="flex h-full min-h-0 flex-col p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
            <PlaneUpLogo className="w-[172px] max-w-full" />
            <button
              type="button"
              onClick={onCloseMobile}
              className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-cyan-300/20 bg-cyan-400/[0.08] text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.14]"
              title="Закрыть меню"
              aria-label="Закрыть меню"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            className={[
              "glass-panel mb-5 hidden px-4 py-4 lg:flex",
              isCollapsed ? "justify-center" : "justify-start",
            ].join(" ")}
          >
            <PlaneUpLogo className={isCollapsed ? "w-[62px]" : "w-[228px] max-w-full"} />
          </div>

          <div className="mb-4 hidden lg:flex">
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
              aria-label={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
              className={[
                "inline-flex h-9 items-center rounded-none border border-cyan-300/20 bg-cyan-400/[0.08] text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.14]",
                isCollapsed ? "w-full justify-center" : "ml-auto w-9 justify-center",
              ].join(" ")}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          <nav
            className={[
              "min-h-0 flex-1 overflow-y-auto pr-1",
              isCollapsed ? "space-y-2" : "space-y-5",
            ].join(" ")}
          >
            {groups.map((group) => {
              const isGroupCollapsible = Boolean(group.collapsible) && !isCollapsed;
              const isGroupOpen = !isGroupCollapsible || openGroups[group.label] !== false;

              return (
                <div key={group.label || "navigation"} className="space-y-2">
                  {!isCollapsed && group.label ? (
                    isGroupCollapsible ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.label)}
                        className="flex w-full items-center justify-between px-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition hover:text-cyan-100"
                        aria-expanded={isGroupOpen}
                      >
                        <span>{group.label}</span>
                        <ChevronRight
                          className={[
                            "h-3.5 w-3.5 transition-transform duration-200",
                            isGroupOpen ? "rotate-90 text-cyan-200" : "text-slate-600",
                          ].join(" ")}
                        />
                      </button>
                    ) : (
                      <div className="px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {group.label}
                      </div>
                    )
                  ) : null}

                  {isGroupOpen
                    ? group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.id === activeSection;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(item.id)}
                            title={isCollapsed ? item.label : undefined}
                            aria-label={item.label}
                            className={[
                              "group relative flex w-full items-center overflow-hidden rounded-none px-4 py-3 text-left transition-all duration-200",
                              isCollapsed ? "justify-center" : "gap-3",
                              isActive
                                ? "bg-[linear-gradient(90deg,rgba(22,123,156,0.62),rgba(11,40,60,0.94))] text-cyan-50 shadow-[0_0_0_1px_rgba(103,232,249,0.16),inset_0_1px_0_rgba(255,255,255,0.05),0_0_38px_rgba(34,211,238,0.22)]"
                                : "bg-[linear-gradient(180deg,rgba(18,31,44,0.72),rgba(11,20,31,0.76))] text-slate-300 hover:bg-[linear-gradient(180deg,rgba(20,47,64,0.72),rgba(11,24,37,0.84))] hover:text-cyan-50",
                            ].join(" ")}
                          >
                            {isActive ? (
                              <>
                                <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-cyan-200 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
                                <span className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-[linear-gradient(90deg,rgba(34,211,238,0.28),rgba(34,211,238,0.08),transparent)]" />
                              </>
                            ) : null}

                            <span
                              className={[
                                "relative z-10 flex h-11 w-11 items-center justify-center transition-all duration-200",
                                isActive
                                  ? "text-cyan-50 drop-shadow-[0_0_10px_rgba(34,211,238,0.35)]"
                                  : "text-slate-400 group-hover:text-cyan-100",
                              ].join(" ")}
                            >
                              <Icon className="h-5 w-5" />
                            </span>

                            <span
                              className={[
                                "relative z-10 block text-base font-medium",
                                isCollapsed ? "hidden lg:hidden" : "flex-1",
                                item.id === "demand" ? "font-['Space_Grotesk'] font-semibold" : "",
                              ].join(" ")}
                            >
                              {item.label}
                            </span>

                            {!isCollapsed ? (
                              <ChevronRight
                                className={[
                                  "relative z-10 h-4 w-4 transition-transform duration-200",
                                  isActive ? "translate-x-0 text-cyan-200" : "text-slate-500 group-hover:translate-x-0.5",
                                ].join(" ")}
                              />
                            ) : null}
                          </button>
                        );
                      })
                    : null}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
