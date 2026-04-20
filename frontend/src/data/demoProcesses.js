export const demoProcesses = [
  {
    id: "PR-001",
    code: "PR-001",
    name: "Подготовка основы",
    isActive: true,
    shortDescription: "Подготовительный этап перед последующей ламинацией.",
    description:
      "Процесс стабилизации и подготовки основы перед нанесением декоративных слоёв. Используется в маршрутах полотна как стартовая операция.",
    relatedRoutes: [
      { code: "RT-001", name: "Ламинат белый" },
      { code: "RT-002", name: "Ламинат серый" },
    ],
    stepUsages: [
      { routeCode: "RT-001", routeName: "Ламинат белый", stepNo: 1, stepName: "Подготовка" },
      { routeCode: "RT-002", routeName: "Ламинат серый", stepNo: 1, stepName: "Подготовка" },
    ],
    equipment: ["Линия подготовки полотна"],
  },
  {
    id: "PR-002",
    code: "PR-002",
    name: "Ламинация",
    isActive: true,
    shortDescription: "Ключевой процесс нанесения декоративного слоя.",
    description:
      "Основной производственный процесс для формирования финального или промежуточного полотна. Используется в маршрутах белого и серого ламината.",
    relatedRoutes: [
      { code: "RT-001", name: "Ламинат белый" },
      { code: "RT-002", name: "Ламинат серый" },
    ],
    stepUsages: [
      { routeCode: "RT-001", routeName: "Ламинат белый", stepNo: 2, stepName: "Ламинация" },
      { routeCode: "RT-002", routeName: "Ламинат серый", stepNo: 2, stepName: "Ламинация" },
    ],
    equipment: ["Ламинатор LAM-1600", "Ламинатор LAM-2200"],
  },
  {
    id: "PR-003",
    code: "PR-003",
    name: "Резка в размер",
    isActive: true,
    shortDescription: "Финишная операция получения нужного формата.",
    description:
      "Процесс финальной резки после подготовки или ламинации. Встречается в маршрутах полотна и линейной продукции.",
    relatedRoutes: [
      { code: "RT-001", name: "Ламинат белый" },
      { code: "RT-003", name: "Кромка ПВХ 50 мм" },
    ],
    stepUsages: [
      { routeCode: "RT-001", routeName: "Ламинат белый", stepNo: 3, stepName: "Резка" },
      { routeCode: "RT-003", routeName: "Кромка ПВХ 50 мм", stepNo: 2, stepName: "Резка" },
    ],
    equipment: ["Резательный комплекс полотна", "Линия продольной резки профиля"],
  },
  {
    id: "PR-004",
    code: "PR-004",
    name: "Окраска профиля",
    isActive: true,
    shortDescription: "Подготовка линейного полуфабриката перед резкой.",
    description:
      "Процесс окраски базового ПВХ-профиля для последующего выпуска кромки. Работает в маршрутах линейной продукции.",
    relatedRoutes: [{ code: "RT-003", name: "Кромка ПВХ 50 мм" }],
    stepUsages: [
      { routeCode: "RT-003", routeName: "Кромка ПВХ 50 мм", stepNo: 1, stepName: "Окраска" },
    ],
    equipment: ["Линия окраски профиля"],
  },
  {
    id: "PR-005",
    code: "PR-005",
    name: "Перемотка",
    isActive: false,
    shortDescription: "Резервный процесс переналадки рулонного материала.",
    description:
      "Дополнительный технологический процесс для будущих маршрутов. В текущих demo-данных оставлен как неактивный резерв.",
    relatedRoutes: [],
    stepUsages: [],
    equipment: ["Станция перемотки рулонов"],
  },
  {
    id: "PR-006",
    code: "PR-006",
    name: "Продольная резка",
    isActive: true,
    shortDescription: "Операция продольного деления материала на полосы.",
    description:
      "Процесс точной продольной резки для рулонных и линейных материалов. В demo-слое пока не привязан к активным маршрутам.",
    relatedRoutes: [],
    stepUsages: [],
    equipment: ["Линия продольной резки профиля"],
  },
];
