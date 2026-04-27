import { BarChart3, Boxes, Cog, ScrollText, Workflow } from "lucide-react";
import { useCallback, useState } from "react";

import SectionPlaceholder from "./components/layout/SectionPlaceholder";
import Sidebar from "./components/layout/Sidebar";
import MachinesSection from "./sections/MachinesSection";
import NomenclatureSection from "./sections/NomenclatureSection";
import ProcessesSection from "./sections/ProcessesSection";
import ReportsSection from "./sections/ReportsSection";
import RoutesSection from "./sections/RoutesSection";

const navigationItems = [
  { id: "nomenclature", label: "Номенклатура", icon: Boxes },
  { id: "processes", label: "Технологические операции", icon: Workflow },
  { id: "routes", label: "Маршруты", icon: ScrollText },
  { id: "machines", label: "Оборудование", icon: Cog },
  { id: "reports", label: "Отчёты", icon: BarChart3 },
];

const sectionDescriptions = {
  nomenclature:
    "Единый справочник позиций для маршрутов, входов шагов и результатов производства.",
  processes:
    "Операционная модель V2: подготовка, ламинация, резка и другие технологические операции маршрутов.",
  routes:
    "Маршруты связывают номенклатуру, шаги, входы и оборудование в производственную цепочку V2.",
  machines:
    "Справочник оборудования с ролями, производительностью и привязкой к шагам маршрутов.",
  reports:
    "Будущие аналитические срезы по выпуску, потребности во входах и загрузке оборудования.",
};

function App() {
  const [activeSection, setActiveSection] = useState("machines");
  const [routeOpenRequest, setRouteOpenRequest] = useState({
    routeId: null,
    version: 0,
  });

  const handleOpenRouteFromNomenclature = useCallback((routeId) => {
    if (!routeId) {
      return;
    }

    setRouteOpenRequest((previousRequest) => ({
      routeId,
      version: previousRequest.version + 1,
    }));
    setActiveSection("routes");
  }, []);

  const activeItem =
    navigationItems.find((item) => item.id === activeSection) ?? navigationItems[0];

  return (
    <div className="min-h-screen text-slate-100">
      <div className="glass-shell flex min-h-screen w-full overflow-hidden rounded-none">
        <Sidebar
          items={navigationItems}
          activeSection={activeSection}
          onSelect={setActiveSection}
        />

        <main className="relative flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(8,19,30,0.45),rgba(6,13,22,0.72))]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(48,170,212,0.14),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)]" />
          <div className="relative h-full overflow-y-auto p-4 sm:p-6 xl:p-8">
            {activeSection === "nomenclature" ? (
              <NomenclatureSection onOpenRoute={handleOpenRouteFromNomenclature} />
            ) : activeSection === "processes" ? (
              <ProcessesSection />
            ) : activeSection === "routes" ? (
              <RoutesSection routeOpenRequest={routeOpenRequest} />
            ) : activeSection === "machines" ? (
              <MachinesSection />
            ) : activeSection === "reports" ? (
              <ReportsSection />
            ) : (
              <SectionPlaceholder
                title={activeItem.label}
                description={sectionDescriptions[activeSection]}
                icon={activeItem.icon}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
