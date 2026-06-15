import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Cog,
  LineChart,
  OctagonPause,
  ScrollText,
  Wrench,
  Workflow,
} from "lucide-react";
import { useCallback, useState } from "react";

import SectionPlaceholder from "./components/layout/SectionPlaceholder";
import Sidebar from "./components/layout/Sidebar";
import DemandSection from "./sections/DemandSection";
import DowntimeReasonsSection from "./sections/DowntimeReasonsSection";
import EquipmentDowntimesSection from "./sections/EquipmentDowntimesSection";
import EquipmentMaintenanceSection from "./sections/EquipmentMaintenanceSection";
import MachinesSection from "./sections/MachinesSection";
import MasterWorkspaceSection from "./sections/MasterWorkspaceSection";
import NomenclatureSection from "./sections/NomenclatureSection";
import ProcessesSection from "./sections/ProcessesSection";
import ProductionPlanningSection from "./sections/ProductionPlanningSection";
import ProductionAnalyticsSection from "./sections/ProductionAnalyticsSection";
import RoutesSection from "./sections/RoutesSection";

function ProductionPlanningIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 20h18" />
      <path d="M5 20V7" />
      <path d="M12 20V5" />
      <path d="M19 20V3.5" />
      <path d="M5 7l4 1.9L5 10.8V7z" />
      <path d="M12 5l4.2 2L12 9V5z" />
      <path d="M19 3.5l3 1.5L19 6.5v-3z" />
    </svg>
  );
}

function MasterWorkspaceIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 20h18" />
      <path d="M6 20V8h12v12" />
      <path d="M9 8V5h6v3" />
      <path d="M9 12h6" />
      <path d="M9 15h3" />
    </svg>
  );
}

const navigationGroups = [
  {
    label: "ОБЗОР",
    items: [{ id: "production_analytics", label: "Анализ выпуска", icon: LineChart }],
  },
  {
    label: "ВХОДНЫЕ ДАННЫЕ",
    items: [{ id: "demand", label: "Потребность", icon: BarChart3 }],
  },
  {
    label: "ПЛАНИРОВАНИЕ",
    items: [{ id: "production_planning", label: "Планирование выпуска", icon: ProductionPlanningIcon }],
  },
  {
    label: "ИСПОЛНЕНИЕ",
    items: [
      { id: "master_workspace", label: "Рабочий стол мастера", icon: MasterWorkspaceIcon },
      {
        id: "equipment_downtimes",
        label: "Внеплановые простои",
        icon: OctagonPause,
      },
    ],
  },
  {
    label: "ОГРАНИЧЕНИЯ",
    items: [
      { id: "machines", label: "Оборудование", icon: Cog },
      { id: "equipment_maintenance", label: "Плановое ТО", icon: Wrench },
    ],
  },
  {
    label: "СПРАВОЧНИКИ",
    collapsible: true,
    items: [
      { id: "nomenclature", label: "Номенклатура", icon: Boxes },
      { id: "processes", label: "Технологические операции", icon: Workflow },
      { id: "routes", label: "Маршруты", icon: ScrollText },
      { id: "downtime_reasons", label: "Причины простоев", icon: AlertTriangle },
    ],
  },
];

const navigationItems = navigationGroups.flatMap((group) => group.items);

const sectionDescriptions = {
  nomenclature:
    "Единый справочник позиций для маршрутов, входов шагов и результатов производства.",
  processes:
    "Операционная модель V2: подготовка, ламинация, резка и другие технологические операции маршрутов.",
  routes:
    "Маршруты связывают номенклатуру, шаги, входы и оборудование в производственную цепочку V2.",
  machines:
    "Справочник оборудования с ролями, производительностью и привязкой к шагам маршрутов.",
  equipment_maintenance:
    "Плановые интервалы недоступности оборудования для расчета доступности в недельном плане.",
  downtime_reasons:
    "Справочник причин для будущего журнала внеплановых простоев оборудования и чистой аналитики.",
  equipment_downtimes:
    "Журнал фактических внеплановых остановок оборудования с открытыми и закрытыми простоями.",
  demand:
    "Подготовка исходных данных, запуск расчета потребности и проверка результатов.",
  production_planning:
    "Месячный план выпуска по производимой номенклатуре с приоритетами и комментариями.",
  production_analytics:
    "Контроль выполнения месячного плана выпуска и анализ производственных отклонений.",
  master_workspace:
    "Фиксация факта выпуска за смену по строкам недельного плана для оперативного контроля выполнения.",
};

function App() {
  const [activeSection, setActiveSection] = useState("demand");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
          items={navigationGroups}
          activeSection={activeSection}
          onSelect={setActiveSection}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((currentValue) => !currentValue)}
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
            ) : activeSection === "equipment_maintenance" ? (
              <EquipmentMaintenanceSection />
            ) : activeSection === "downtime_reasons" ? (
              <DowntimeReasonsSection />
            ) : activeSection === "equipment_downtimes" ? (
              <EquipmentDowntimesSection />
            ) : activeSection === "demand" ? (
              <DemandSection />
            ) : activeSection === "production_planning" ? (
              <ProductionPlanningSection />
            ) : activeSection === "production_analytics" ? (
              <ProductionAnalyticsSection />
            ) : activeSection === "master_workspace" ? (
              <MasterWorkspaceSection />
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
