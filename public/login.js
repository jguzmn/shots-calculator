import { iniciarSesion, obtenerSesion } from "./auth-client.js";

const email = document.getElementById("email");
const password = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const mensaje = document.getElementById("mensaje");
const params = new URLSearchParams(window.location.search);
const next = params.get("next") || "index.html";

function mostrarMensaje(texto, tipo = "error") {
  mensaje.textContent = texto;
  mensaje.className = `message message-${tipo}`;
  mensaje.hidden = false;
}

function limpiarMensaje() {
  mensaje.textContent = "";
  mensaje.hidden = true;
}

async function redirigirSiHaySesion() {
  const session = await obtenerSesion();

  if (session) {
    window.location.href = next;
  }
}

async function enviarLogin() {
  limpiarMensaje();

  if (!email.value.trim() || !password.value) {
    mostrarMensaje("Ingresa correo y contraseña.");
    return;
  }

  try {
    btnLogin.disabled = true;
    await iniciarSesion(email.value.trim(), password.value);
    window.location.href = next;
  } catch (error) {
    mostrarMensaje(error.message);
  } finally {
    btnLogin.disabled = false;
  }
}

btnLogin.addEventListener("click", enviarLogin);

password.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    enviarLogin();
  }
});

email.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    password.focus();
  }
});

redirigirSiHaySesion();
