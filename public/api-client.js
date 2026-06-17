async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "No se pudo completar la operación.");
  }

  return payload;
}

export function listarBotellas() {
  return request("/api/botellas");
}

export function obtenerBotella(id) {
  return request(`/api/botellas/${id}`);
}

export function crearBotella(datos) {
  return request("/api/botellas", {
    method: "POST",
    body: JSON.stringify(datos)
  });
}

export function actualizarBotella(id, datos) {
  return request(`/api/botellas/${id}/actualizar`, {
    method: "POST",
    body: JSON.stringify(datos)
  });
}

export function eliminarBotella(id) {
  return request(`/api/botellas/${id}/eliminar`, {
    method: "POST"
  });
}

export function registrarMedicion(datos) {
  return request("/api/mediciones", {
    method: "POST",
    body: JSON.stringify(datos)
  });
}

export function listarMediciones(filtros = {}) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return request(`/api/mediciones${query ? `?${query}` : ""}`);
}
