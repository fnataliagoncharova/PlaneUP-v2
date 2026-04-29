import { ChevronRight, Factory, Sparkles } from "lucide-react";

function Sidebar({ items, activeSection, onSelect }) {
  return (
    <aside className="w-full border-b border-cyan-300/10 bg-[linear-gradient(180deg,rgba(8,18,29,0.98),rgba(9,20,31,0.95)_55%,rgba(7,15,24,0.98))] lg:w-[292px] lg:border-b-0 lg:border-r lg:border-r-cyan-300/10">
      <div className="flex h-full flex-col p-4 sm:p-5">
        <div className="glass-panel mb-5 flex items-center gap-4 px-4 py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-none border border-cyan-300/28 bg-[linear-gradient(180deg,rgba(24,85,107,0.5),rgba(12,28,40,0.82))] text-cyan-100 shadow-cyanGlow">
            <Factory className="h-7 w-7" />
          </div>
          <div>
            <div className="font-['Space_Grotesk'] text-xl font-semibold text-slate-50">
              PlaneUP V2
            </div>
            <div className="mt-1 text-sm text-slate-400">Industrial Flow UI</div>
          </div>
        </div>

        <nav className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeSection;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={[
                  "group relative flex w-full items-center gap-3 overflow-hidden rounded-none px-4 py-3 text-left transition-all duration-200",
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
                    "relative z-10 flex-1 block text-base font-medium",
                    item.id === "demand" ? "font-['Space_Grotesk'] font-semibold" : "",
                  ].join(" ")}
                >
                  {item.label}
                </span>
                <ChevronRight
                  className={[
                    "relative z-10 h-4 w-4 transition-transform duration-200",
                    isActive ? "translate-x-0 text-cyan-200" : "text-slate-500 group-hover:translate-x-0.5",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-5">
          <div className="glass-panel px-4 py-4">
            <div className="flex items-center gap-2 text-cyan-100">
              <Sparkles className="h-4 w-4" />
              <span className="panel-title">V2 foundation</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Каркас готов для подключения backend V2, CRUD-операций и развития остальных
              разделов в едином визуальном языке.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
