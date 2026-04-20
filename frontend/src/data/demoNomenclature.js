export const demoNomenclature = [
  {
    id: "NM-001",
    code: "NM-001",
    name: "Полотно-основа универсальное",
    unit: "м²",
    shortDescription: "Базовая основа для белого и серого ламината.",
    description:
      "Общая номенклатура для нескольких маршрутов V2. Используется как ключевой вход при расчёте суммарной потребности.",
    isActive: true,
    isRouteResult: false,
    isRouteInput: true,
    usageSummary:
      "Используется как общий вход для двух верхних позиций. На этой позиции удобно проверять консолидацию спроса.",
    relatedRoutes: [
      { code: "RT-001", name: "Ламинат белый", relation: "Вход" },
      { code: "RT-002", name: "Ламинат серый", relation: "Вход" },
    ],
  },
  {
    id: "NM-002",
    code: "NM-002",
    name: "Полотно грунтованное",
    unit: "м²",
    shortDescription: "Подготовленный полуфабрикат перед ламинацией.",
    description:
      "Промежуточная позиция после подготовки основы. Применяется как вход в шаги ламинации.",
    isActive: true,
    isRouteResult: false,
    isRouteInput: true,
    usageSummary:
      "Связывает подготовительные шаги и операции ламинации в нескольких маршрутах полотна.",
    relatedRoutes: [
      { code: "RT-001", name: "Ламинат белый", relation: "Вход" },
      { code: "RT-002", name: "Ламинат серый", relation: "Вход" },
    ],
  },
  {
    id: "NM-003",
    code: "NM-003",
    name: "Полотно ламинированное белое полуфабрикат",
    unit: "м²",
    shortDescription: "Результат шага ламинации перед финишной резкой.",
    description:
      "Промежуточный результат маршрута RT-001. Используется как вход следующего шага внутри технологической цепочки.",
    isActive: true,
    isRouteResult: false,
    isRouteInput: true,
    usageSummary:
      "Показывает типовой сценарий, когда результат одного шага становится входом следующего шага.",
    relatedRoutes: [{ code: "RT-001", name: "Ламинат белый", relation: "Вход шага 3" }],
  },
  {
    id: "NM-004",
    code: "NM-004",
    name: "Полотно ламинированное белое",
    unit: "м²",
    shortDescription: "Готовая верхняя позиция белого ламината.",
    description:
      "Целевая позиция маршрута RT-001. Используется как финальный результат выпуска и ориентир для планирования спроса.",
    isActive: true,
    isRouteResult: true,
    isRouteInput: false,
    usageSummary:
      "Финальный результат маршрута RT-001. По этой позиции удобно проверять разворачивание спроса в входную номенклатуру.",
    relatedRoutes: [{ code: "RT-001", name: "Ламинат белый", relation: "Результат маршрута" }],
  },
  {
    id: "NM-005",
    code: "NM-005",
    name: "Полотно ламинированное серое",
    unit: "м²",
    shortDescription: "Готовая верхняя позиция серого ламината.",
    description:
      "Целевая позиция маршрута RT-002. Вместе с белой версией использует общую основу в расчётах потребности.",
    isActive: true,
    isRouteResult: true,
    isRouteInput: false,
    usageSummary:
      "Вторая верхняя позиция для проверки суммарной потребности по общей основе NM-001.",
    relatedRoutes: [{ code: "RT-002", name: "Ламинат серый", relation: "Результат маршрута" }],
  },
  {
    id: "NM-008",
    code: "NM-008",
    name: "Профиль ПВХ базовый",
    unit: "м.п.",
    shortDescription: "Базовый линейный профиль под окраску.",
    description:
      "Линейная номенклатура в единице измерения м.п. Используется как вход в маршрут кромки ПВХ.",
    isActive: true,
    isRouteResult: false,
    isRouteInput: true,
    usageSummary:
      "Покрывает второй тип единиц измерения в V2 и нужен для проверки работы интерфейса с линейными продуктами.",
    relatedRoutes: [{ code: "RT-003", name: "Кромка ПВХ 50 мм", relation: "Вход" }],
  },
  {
    id: "NM-010",
    code: "NM-010",
    name: "Кромка ПВХ белая 50 мм",
    unit: "м.п.",
    shortDescription: "Финальная линейная позиция маршрута RT-003.",
    description:
      "Готовая линейная продукция для маршрута резки профиля. Нужна для проверки интерфейса с единицей измерения м.п.",
    isActive: true,
    isRouteResult: true,
    isRouteInput: false,
    usageSummary:
      "Финальный результат маршрута RT-003 и отдельный пример верхней позиции в м.п.",
    relatedRoutes: [{ code: "RT-003", name: "Кромка ПВХ 50 мм", relation: "Результат маршрута" }],
  },
];
