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

export function listarClientes() {
  return request("/api/admin/clientes");
}

export function crearCliente(datos) {
  return request("/api/admin/clientes", {
    method: "POST",
    body: JSON.stringify(datos)
  });
}

export function actualizarCliente(id, datos) {
  return request(`/api/admin/clientes/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos)
  });
}

export function copiarCatalogoBase(clienteId) {
  return request(`/api/admin/clientes/${clienteId}/copiar-catalogo-base`, {
    method: "POST"
  });
}

export function listarUsuarios() {
  return request("/api/admin/usuarios");
}

export function crearUsuario(datos) {
  return request("/api/admin/usuarios", {
    method: "POST",
    body: JSON.stringify(datos)
  });
}

export function actualizarUsuario(id, datos) {
  return request(`/api/admin/usuarios/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos)
  });
}

export function eliminarUsuario(id) {
  return request(`/api/admin/usuarios/${id}`, {
    method: "DELETE"
  });
}

export function resetearPasswordUsuario(id, password) {
  return request(`/api/admin/usuarios/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password })
  });
}
