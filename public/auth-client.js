async function authRequest(path, options = {}) {
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

export async function obtenerSesion() {
  try {
    return await authRequest("/api/auth/me");
  } catch (error) {
    return null;
  }
}

export async function requerirSesion() {
  const session = await obtenerSesion();

  if (!session) {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.href = `login.html?next=${next}`;
    return null;
  }

  return session;
}

export function iniciarSesion(email, password) {
  return authRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function cerrarSesion() {
  return authRequest("/api/auth/logout", {
    method: "POST"
  });
}

export function configurarCerrarSesion() {
  const button = document.getElementById("btnCerrarSesion");

  if (!button) {
    return;
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    await cerrarSesion();
    window.location.href = "login.html";
  });
}

export function configurarNavegacionAdmin(session) {
  if (session?.user?.rol !== "super_admin") {
    return;
  }

  document.querySelectorAll(".admin-only").forEach((item) => {
    item.hidden = false;
  });
}
