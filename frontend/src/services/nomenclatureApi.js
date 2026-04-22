import { apiRequest } from "./apiClient";

export function getNomenclatureList() {
  return apiRequest("/nomenclature");
}

export function getNomenclatureItem(nomenclatureId) {
  return apiRequest(`/nomenclature/${nomenclatureId}`);
}

export function createNomenclatureItem(payload) {
  return apiRequest("/nomenclature", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateNomenclatureItem(nomenclatureId, payload) {
  return apiRequest(`/nomenclature/${nomenclatureId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteNomenclatureItem(nomenclatureId) {
  return apiRequest(`/nomenclature/${nomenclatureId}`, {
    method: "DELETE",
  });
}

