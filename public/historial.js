import { listarMediciones } from "./api-client.js";
import { configurarCerrarSesion, configurarNavegacionAdmin, requerirSesion } from "./auth-client.js";

const tabla = document.querySelector("#tablaMediciones tbody");
const mensaje = document.getElementById("mensaje");

function mostrarMensaje(texto, tipo = "error") {
  mensaje.textContent = texto;
  mensaje.className = `message message-${tipo}`;
  mensaje.hidden = false;
}

function formatearFecha(valor) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(valor));
}

function renderMediciones(lista) {
  tabla.innerHTML = "";

  if (!lista.length) {
    tabla.innerHTML = '<tr><td colspan="6">No hay mediciones registradas.</td></tr>';
    return;
  }

  lista.forEach((item) => {
    const tr = document.createElement("tr");
    const fecha = document.createElement("td");
    const botella = document.createElement("td");
    const peso = document.createElement("td");
    const trago = document.createElement("td");
    const tragos = document.createElement("td");
    const usuario = document.createElement("td");

    fecha.textContent = formatearFecha(item.creadaEn);
    botella.textContent = item.botellaNombre;
    peso.textContent = `${item.pesoActual.toFixed(2)} g`;
    trago.textContent = `${item.tamanoTrago.toFixed(2)} mL`;
    tragos.textContent = `${item.tragosDecimales.toFixed(2)} (${item.tragosFraccion})`;
    usuario.textContent = item.usuarioNombre;

    tr.append(fecha, botella, peso, trago, tragos, usuario);
    tabla.appendChild(tr);
  });
}

async function cargarMediciones() {
  try {
    tabla.innerHTML = '<tr><td colspan="6">Cargando mediciones...</td></tr>';
    const data = await listarMediciones();
    renderMediciones(data);
  } catch (error) {
    tabla.innerHTML = "";
    mostrarMensaje(error.message);
  }
}

async function iniciar() {
  const session = await requerirSesion();

  if (!session) {
    return;
  }

  configurarCerrarSesion();
  configurarNavegacionAdmin(session);
  await cargarMediciones();
}

iniciar();
