import { apiRequest, apiRequestBlob } from "./apiClient";

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

export function previewNomenclatureImport(file, importMode) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("import_mode", importMode);

  return apiRequest("/nomenclature/import/preview", {
    method: "POST",
    body: formData,
  });
}

export function commitNomenclatureImport(file, importMode) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("import_mode", importMode);

  return apiRequest("/nomenclature/import/commit", {
    method: "POST",
    body: formData,
  });
}

export function downloadNomenclatureImportTemplate() {
  return apiRequestBlob("/nomenclature/import/template");
}
