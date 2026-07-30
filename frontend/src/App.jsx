import {
  AlertTriangle,
  BarChart3,
  Boxes,
  Cog,
  LineChart,
  LogOut,
  Menu,
  OctagonPause,
  ScrollText,
  Shield,
  Wrench,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "./auth/AuthContext";
import { isAdminLikeRole } from "./auth/permissions";

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
import UsersSection from "./sections/UsersSection";

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
    label: "Обзор",
    items: [
      {
        id: "production_analytics",
        label: "Анализ выпуска",
        icon: LineChart,
        roles: ["planner", "viewer"],
      },
    ],
  },
  {
    label: "Входные данные",
    items: [
      {
        id: "demand",
        label: "Потребность",
        icon: BarChart3,
        roles: ["planner", "viewer"],
      },
    ],
  },
  {
    label: "Планирование",
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
    label: "Исполнение",
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
    label: "Ограничения",
    items: [
      {
        id: "machines",
        label: "Оборудование",
        icon: Cog,
        roles: ["planner", "master", "maintenance", "viewer"],
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
    label: "Справочники",
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
        roles: ["planner", "master", "maintenance", "viewer"],
      },
    ],
  },
  {
    label: "Администрирование",
    items: [
      {
        id: "users",
        label: "Пользователи",
        icon: Shield,
        roles: ["admin"],
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
  users: "Управление пользователями",
};

function App() {
  const { user, loading, logout } = useAuth();

  const [activeSection, setActiveSection] = useState("demand");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const filteredNavigationGroups = useMemo(() => {
    const isAdmin = user?.role === "admin";
    const canSeeItem = (item) => {
      if (item.id === "users") {
        return isAdmin;
      }

      return isAdminLikeRole(user?.role) || item.roles?.includes(user?.role);
    };

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = (event) => {
      if (event.matches) {
        setIsMobileSidebarOpen(false);
      }
    };

    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const activeItem =
    visibleNavigationItems.find((item) => item.id === activeSection) ?? visibleNavigationItems[0];
  const renderedSection = activeItem?.id;

  const handleSelectSection = (sectionId) => {
    setActiveSection(sectionId);
    setIsMobileSidebarOpen(false);
  };

  if (loading) {
    return <div className="p-6 text-white">Загрузка...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen text-slate-100">
      <div className="glass-shell flex min-h-screen w-full flex-col overflow-hidden lg:flex-row">
        {visibleNavigationItems.length > 0 ? (
          <Sidebar
            items={filteredNavigationGroups}
            activeSection={activeSection}
            onSelect={handleSelectSection}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((value) => !value)}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />
        ) : null}

        <main className="min-w-0 flex-1 overflow-hidden">
          <div className="relative flex h-full min-w-0 flex-col overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-none border border-cyan-300/20 bg-cyan-400/[0.08] px-3 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/[0.14] lg:hidden"
              >
                <Menu className="h-4 w-4" />
                Меню
              </button>

              <div className="ml-auto flex items-center gap-3 text-sm text-slate-200">
                <span className="truncate">{user.full_name || user.username}</span>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-rose-300/20 bg-rose-400/[0.08] text-rose-200 transition hover:border-rose-300/35 hover:bg-rose-400/[0.14]"
                  title="Выйти"
                  aria-label="Выйти"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>

            <div className="min-w-0 flex-1">
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
              ) : renderedSection === "users" ? (
                <UsersSection />
              ) : (
                <SectionPlaceholder
                  title={activeItem?.label ?? "Нет доступных разделов"}
                  description={sectionDescriptions[renderedSection]}
                  icon={activeItem?.icon}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
