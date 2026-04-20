export const demoMachines = [
  {
    id: "MC-001",
    code: "MC-001",
    name: "Линия подготовки полотна",
    isActive: true,
    shortDescription: "Подготовка основы перед ламинацией.",
    description:
      "Базовая линия для стартовой подготовки полотна перед ламинацией. Используется в белом и сером маршрутах как основное оборудование шага подготовки.",
    relatedRoutes: [
      { code: "RT-001", name: "Ламинат белый" },
      { code: "RT-002", name: "Ламинат серый" },
    ],
    stepUsages: [
      { routeCode: "RT-001", routeName: "Ламинат белый", stepNo: 1, stepName: "Подготовка" },
      { routeCode: "RT-002", routeName: "Ламинат серый", stepNo: 1, stepName: "Подготовка" },
    ],
    operations: ["PR-001 Подготовка основы"],
    usageEntries: [
      {
        routeCode: "RT-001",
        routeName: "Ламинат белый",
        stepNo: 1,
        stepName: "Подготовка",
        operation: "PR-001 Подготовка основы",
        role: "Primary",
        rate: "18.000 м²/мин",
      },
      {
        routeCode: "RT-002",
        routeName: "Ламинат серый",
        stepNo: 1,
        stepName: "Подготовка",
        operation: "PR-001 Подготовка основы",
        role: "Primary",
        rate: "18.000 м²/мин",
      },
    ],
  },
  {
    id: "MC-002",
    code: "MC-002",
    name: "Ламинатор LAM-1600",
    isActive: true,
    shortDescription: "Основной ламинатор для белого полотна.",
    description:
      "Основная ламинаторная линия для формирования белого ламината. Используется как primary-оборудование на ключевом шаге ламинации.",
    relatedRoutes: [{ code: "RT-001", name: "Ламинат белый" }],
    stepUsages: [
      { routeCode: "RT-001", routeName: "Ламинат белый", stepNo: 2, stepName: "Ламинация" },
    ],
    operations: ["PR-002 Ламинация"],
    usageEntries: [
      {
        routeCode: "RT-001",
        routeName: "Ламинат белый",
        stepNo: 2,
        stepName: "Ламинация",
        operation: "PR-002 Ламинация",
        role: "Primary",
        rate: "12.000 м²/мин",
      },
    ],
  },
  {
    id: "MC-003",
    code: "MC-003",
    name: "Ламинатор LAM-2200",
    isActive: true,
    shortDescription: "Альтернативная линия ламинации с более широкой базой.",
    description:
      "Резервная линия ламинации для гибкого планирования. В demo-данных участвует как alternative-оборудование и отдельная primary-линия для серого ламината.",
    relatedRoutes: [
      { code: "RT-001", name: "Ламинат белый" },
      { code: "RT-002", name: "Ламинат серый" },
    ],
    stepUsages: [
      { routeCode: "RT-001", routeName: "Ламинат белый", stepNo: 2, stepName: "Ламинация" },
      { routeCode: "RT-002", routeName: "Ламинат серый", stepNo: 2, stepName: "Ламинация" },
    ],
    operations: ["PR-002 Ламинация"],
    usageEntries: [
      {
        routeCode: "RT-001",
        routeName: "Ламинат белый",
        stepNo: 2,
        stepName: "Ламинация",
        operation: "PR-002 Ламинация",
        role: "Alternative",
        rate: "10.500 м²/мин",
      },
      {
        routeCode: "RT-002",
        routeName: "Ламинат серый",
        stepNo: 2,
        stepName: "Ламинация",
        operation: "PR-002 Ламинация",
        role: "Primary",
        rate: "11.000 м²/мин",
      },
    ],
  },
  {
    id: "MC-004",
    code: "MC-004",
    name: "Резательный комплекс полотна",
    isActive: true,
    shortDescription: "Финишная резка полотна после ламинации.",
    description:
      "Комплекс точной резки для финального получения формата листового полотна. Используется на завершающем шаге маршрута белого ламината.",
    relatedRoutes: [{ code: "RT-001", name: "Ламинат белый" }],
    stepUsages: [
      { routeCode: "RT-001", routeName: "Ламинат белый", stepNo: 3, stepName: "Резка" },
    ],
    operations: ["PR-003 Резка в размер"],
    usageEntries: [
      {
        routeCode: "RT-001",
        routeName: "Ламинат белый",
        stepNo: 3,
        stepName: "Резка",
        operation: "PR-003 Резка в размер",
        role: "Primary",
        rate: "25.000 м²/мин",
      },
    ],
  },
  {
    id: "MC-005",
    code: "MC-005",
    name: "Линия окраски профиля",
    isActive: true,
    shortDescription: "Подготовка линейного профиля перед резкой.",
    description:
      "Линия окраски линейных ПВХ-профилей. Используется для получения промежуточного полуфабриката перед выпуском кромки.",
    relatedRoutes: [{ code: "RT-003", name: "Кромка ПВХ 50 мм" }],
    stepUsages: [
      { routeCode: "RT-003", routeName: "Кромка ПВХ 50 мм", stepNo: 1, stepName: "Окраска" },
    ],
    operations: ["PR-004 Окраска профиля"],
    usageEntries: [
      {
        routeCode: "RT-003",
        routeName: "Кромка ПВХ 50 мм",
        stepNo: 1,
        stepName: "Окраска",
        operation: "PR-004 Окраска профиля",
        role: "Primary",
        rate: "35.000 м.п./мин",
      },
    ],
  },
  {
    id: "MC-006",
    code: "MC-006",
    name: "Линия продольной резки профиля",
    isActive: true,
    shortDescription: "Финальная продольная резка линейной продукции.",
    description:
      "Линия продольной резки для линейных материалов и кромки ПВХ. В V2 демонстрирует работу оборудования с единицей измерения м.п.",
    relatedRoutes: [{ code: "RT-003", name: "Кромка ПВХ 50 мм" }],
    stepUsages: [
      { routeCode: "RT-003", routeName: "Кромка ПВХ 50 мм", stepNo: 2, stepName: "Резка" },
    ],
    operations: ["PR-003 Резка в размер", "PR-006 Продольная резка"],
    usageEntries: [
      {
        routeCode: "RT-003",
        routeName: "Кромка ПВХ 50 мм",
        stepNo: 2,
        stepName: "Резка",
        operation: "PR-003 Резка в размер",
        role: "Primary",
        rate: "42.000 м.п./мин",
      },
    ],
  },
];
