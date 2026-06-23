import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Cog,
  LineChart,
  LogOut,
  OctagonPause,
  ScrollText,
  Wrench,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "./auth/AuthContext";

import SectionPlaceholder from "./components/layout/SectionPlaceholder";
import Sidebar from "./components/layout/Sidebar";
import LoginPage from "./pages/LoginPage";
import DemandSection from "./sections/DemandSection";
import DowntimeReasonsSection from "./sections/DowntimeReasonsSection";
import EquipmentDowntimesSection from "./sections/EquipmentDowntimesSection";
import EquipmentMaintenanceSection from "./sections/EquipmentMaintenanceSection";
import MachinesSection from "./sections/MachinesSection";
import MasterWorkspaceSection from "./sections/MasterWorkspaceSection";
import NomenclatureSection from "./sections/NomenclatureSection";
import ProcessesSection from "./sections/ProcessesSection";
import ProductionAnalyticsSection from "./sections/ProductionAnalyticsSection";
import ProductionPlanningSection from "./sections/ProductionPlanningSection";
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
    >
      <path d="M3 20h18" />
      <path d="M5 20V7" />
      <path d="M12 20V5" />
      <path d="M19 20V3.5" />
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
    >
      <path d="M3 20h18" />
      <path d="M6 20V8h12v12" />
      <path d="M9 8V5h6v3" />
    </svg>
  );
}

const navigationGroups = [
  {
    label: "ОБЗОР",
    items: [
      {
        id: "production_analytics",
        label: "Анализ выпуска",
        icon: LineChart,
        roles: ["planner", "master", "maintenance", "viewer"],
      },
    ],
  },
  {
    label: "ВХОДНЫЕ ДАННЫЕ",
    items: [
      {
        id: "demand",
        label: "Потребность",
        icon: BarChart3,
        roles: ["planner", "master", "maintenance", "viewer"],
      },
    ],
  },
  {
    label: "ПЛАНИРОВАНИЕ",
    items: [
      {
        id: "production_planning",
        label: "Планирование выпуска",
        icon: ProductionPlanningIcon,
        roles: ["planner", "master", "maintenance", "viewer"],
      },
    ],
  },
  {
    label: "ИСПОЛНЕНИЕ",
    items: [
      {
        id: "master_workspace",
        label: "Рабочий стол мастера",
        icon: MasterWorkspaceIcon,
        roles: ["planner", "master", "viewer"],
      },
      {
        id: "equipment_downtimes",
        label: "Внеплановые простои",
        icon: OctagonPause,
        roles: ["planner", "master", "maintenance", "viewer"],
      },
    ],
  },
  {
    label: "ОГРАНИЧЕНИЯ",
    items: [
      {
        id: "machines",
        label: "Оборудование",
        icon: Cog,
        roles: ["planner", "maintenance", "viewer"],
      },
      {
        id: "equipment_maintenance",
        label: "Плановое ТО",
        icon: Wrench,
        roles: ["planner", "master", "maintenance", "viewer"],
      },
    ],
  },
  {
    label: "СПРАВОЧНИКИ",
    items: [
      {
        id: "nomenclature",
        label: "Номенклатура",
        icon: Boxes,
        roles: ["planner", "master", "maintenance", "viewer"],
      },
      {
        id: "processes",
        label: "Технологические операции",
        icon: Workflow,
        roles: ["planner", "master", "maintenance", "viewer"],
      },
      {
        id: "routes",
        label: "Маршруты",
        icon: ScrollText,
        roles: ["planner", "master", "maintenance", "viewer"],
      },
      {
        id: "downtime_reasons",
        label: "Причины простоев",
        icon: AlertTriangle,
        roles: ["planner", "maintenance", "viewer"],
      },
    ],
  },
];

const sectionDescriptions = {
  nomenclature: "Справочник номенклатуры",
  processes: "Технологические операции",
  routes: "Маршруты производства",
  machines: "Оборудование",
  equipment_maintenance: "Плановое ТО",
  downtime_reasons: "Причины простоев",
  equipment_downtimes: "Внеплановые простои",
  demand: "Потребность",
  production_planning: "План выпуска",
  production_analytics: "Анализ выпуска",
  master_workspace: "Рабочий стол мастера",
};

function App() {
  const { user, loading, logout } = useAuth();

  const [activeSection, setActiveSection] = useState("demand");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const filteredNavigationGroups = useMemo(() => {
    const isAdmin = user?.role === "admin";
    const canSeeItem = (item) => isAdmin || item.roles?.includes(user?.role);

    if (isAdmin) {
      return navigationGroups;
    }

    return navigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(canSeeItem),
      }))
      .filter((group) => group.items.length > 0);
  }, [user?.role]);

  const visibleNavigationItems = useMemo(
    () => filteredNavigationGroups.flatMap((group) => group.items),
    [filteredNavigationGroups],
  );

  useEffect(() => {
    if (visibleNavigationItems.length === 0) {
      return;
    }

    if (!visibleNavigationItems.some((item) => item.id === activeSection)) {
      setActiveSection(visibleNavigationItems[0].id);
    }
  }, [activeSection, visibleNavigationItems]);

  const activeItem =
    visibleNavigationItems.find((item) => item.id === activeSection) ?? visibleNavigationItems[0];
  const renderedSection = activeItem?.id;

  if (loading) {
    return <div className="p-6 text-white">Загрузка...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen text-slate-100">
      <div className="glass-shell flex min-h-screen w-full overflow-hidden">
        {visibleNavigationItems.length > 0 ? (
          <Sidebar
            items={filteredNavigationGroups}
            activeSection={activeSection}
            onSelect={setActiveSection}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
          />
        ) : null}

        <main className="flex-1 overflow-hidden">
          <div className="relative h-full overflow-y-auto p-6">
            <div className="mb-4 flex justify-end">
              <div className="flex items-center gap-3 text-sm">
                <span>{user.full_name || user.username}</span>
                <button onClick={logout} className="text-red-400">
                  <LogOut size={16} />
                </button>
              </div>
            </div>

            {visibleNavigationItems.length === 0 ? (
              <div className="glass-panel p-5 text-sm text-slate-300">Нет доступных разделов.</div>
            ) : renderedSection === "nomenclature" ? (
              <NomenclatureSection />
            ) : renderedSection === "processes" ? (
              <ProcessesSection />
            ) : renderedSection === "routes" ? (
              <RoutesSection />
            ) : renderedSection === "machines" ? (
              <MachinesSection />
            ) : renderedSection === "equipment_maintenance" ? (
              <EquipmentMaintenanceSection />
            ) : renderedSection === "downtime_reasons" ? (
              <DowntimeReasonsSection />
            ) : renderedSection === "equipment_downtimes" ? (
              <EquipmentDowntimesSection />
            ) : renderedSection === "demand" ? (
              <DemandSection />
            ) : renderedSection === "production_planning" ? (
              <ProductionPlanningSection />
            ) : renderedSection === "production_analytics" ? (
              <ProductionAnalyticsSection />
            ) : renderedSection === "master_workspace" ? (
              <MasterWorkspaceSection />
            ) : (
              <SectionPlaceholder
                title={activeItem?.label ?? "Нет доступных разделов"}
                description={sectionDescriptions[renderedSection]}
                icon={activeItem?.icon}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
