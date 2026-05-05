import { apiRequest } from "./apiClient";

export function getProductionPlans() {
  return apiRequest("/production-plans");
}

export function getProductionPlan(planId) {
  return apiRequest(`/production-plans/${planId}`);
}

export function createProductionPlan(payload) {
  return apiRequest("/production-plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createProductionPlanFromDemand(payload) {
  return apiRequest("/production-plans/from-demand", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function refreshProductionPlanFromDemand(planId, payload) {
  return apiRequest(`/production-plans/${planId}/refresh-from-demand`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function approveProductionPlan(planId) {
  return apiRequest(`/production-plans/${planId}/approve`, {
    method: "POST",
  });
}

export function returnProductionPlanToDraft(planId) {
  return apiRequest(`/production-plans/${planId}/return-to-draft`, {
    method: "POST",
  });
}

export function updateProductionPlan(planId, payload) {
  return apiRequest(`/production-plans/${planId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProductionPlan(planId) {
  return apiRequest(`/production-plans/${planId}`, {
    method: "DELETE",
  });
}

export function addProductionPlanLine(planId, payload) {
  return apiRequest(`/production-plans/${planId}/lines`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProductionPlanLine(lineId, payload) {
  return apiRequest(`/production-plans/lines/${lineId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProductionPlanLine(lineId) {
  return apiRequest(`/production-plans/lines/${lineId}`, {
    method: "DELETE",
  });
}

export function getProductionPlanWeeks(productionPlanId) {
  return apiRequest(`/production-plans/${productionPlanId}/weeks`);
}

export function createProductionPlanWeek(productionPlanId, payload) {
  return apiRequest(`/production-plans/${productionPlanId}/weeks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getProductionWeekPlan(weekId) {
  return apiRequest(`/production-week-plans/${weekId}`);
}

export function updateProductionWeekPlan(weekId, payload) {
  return apiRequest(`/production-week-plans/${weekId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProductionWeekPlan(weekId) {
  return apiRequest(`/production-week-plans/${weekId}`, {
    method: "DELETE",
  });
}

export function addProductionWeekLine(weekId, payload) {
  return apiRequest(`/production-week-plans/${weekId}/lines`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProductionWeekLine(lineId, payload) {
  return apiRequest(`/production-week-plans/lines/${lineId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteProductionWeekLine(lineId) {
  return apiRequest(`/production-week-plans/lines/${lineId}`, {
    method: "DELETE",
  });
}
