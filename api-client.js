async function request(path, options = {}) {
  const response = await fetch(path, {
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
    throw new Error(payload.message || "No se pudo completar la operacion.");
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
  return request(`/api/botellas/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos)
  });
}

export function eliminarBotella(id) {
  return request(`/api/botellas/${id}`, {
    method: "DELETE"
  });
}
