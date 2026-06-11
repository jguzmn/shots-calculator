import { actualizarBotella, crearBotella, obtenerBotella } from "./api-client.js";
import { configurarCerrarSesion, configurarNavegacionAdmin, requerirSesion } from "./auth-client.js";

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const titulo = document.getElementById("titulo");
const nombre = document.getElementById("nombre");
const pesoVacio = document.getElementById("pesoVacio");
const densidad = document.getElementById("densidad");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");
const mensaje = document.getElementById("mensaje");

function mostrarMensaje(texto, tipo = "error") {
  mensaje.textContent = texto;
  mensaje.className = `message message-${tipo}`;
  mensaje.hidden = false;
}

function limpiarMensaje() {
  mensaje.textContent = "";
  mensaje.hidden = true;
}

async function cargarBotella() {
  try {
    const data = await obtenerBotella(id);
    nombre.value = data.nombre;
    pesoVacio.value = data.pesoVacio;
    densidad.value = data.densidad;
  } catch (error) {
    mostrarMensaje(error.message);
  }
}

btnGuardar.addEventListener("click", async () => {
  limpiarMensaje();

  const datos = {
    nombre: nombre.value.trim(),
    pesoVacio: Number(pesoVacio.value),
    densidad: Number(densidad.value)
  };

  if (!datos.nombre) {
    mostrarMensaje("El nombre es obligatorio.");
    return;
  }

  if (!Number.isFinite(datos.pesoVacio) || datos.pesoVacio <= 0) {
    mostrarMensaje("El peso vacío debe ser mayor que cero.");
    return;
  }

  if (!Number.isFinite(datos.densidad) || datos.densidad <= 0) {
    mostrarMensaje("La densidad debe ser mayor que cero.");
    return;
  }

  try {
    btnGuardar.disabled = true;
    if (id) await actualizarBotella(id, datos);
    else await crearBotella(datos);
    window.location.href = "botellas.html";
  } catch (error) {
    mostrarMensaje(error.message);
  } finally {
    btnGuardar.disabled = false;
  }
});

btnCancelar.addEventListener("click", () => {
  window.location.href = "botellas.html";
});

async function iniciar() {
  const session = await requerirSesion();

  if (!session) {
    return;
  }

  configurarCerrarSesion();
  configurarNavegacionAdmin(session);

  if (id) {
    titulo.textContent = "Editar Botella";
    await cargarBotella();
  }
}

iniciar();
