import { listarBotellas } from "./api-client.js";
import { calcularTragos as calcularTragosDisponibles } from "./calculator.js";

const botella = document.getElementById("botella");
const pesoActual = document.getElementById("pesoActual");
const tamTrago = document.getElementById("tamTrago");
const btnCalcular = document.getElementById("btnCalcular");
const mensaje = document.getElementById("mensaje");
const pesoLicor = document.getElementById("pesoLicor");
const tragosDecimales = document.getElementById("tragosDecimales");
const tragosFraccion = document.getElementById("tragosFraccion");

function mostrarMensaje(texto, tipo = "error") {
  mensaje.textContent = texto;
  mensaje.className = `message message-${tipo}`;
  mensaje.hidden = false;
}

function limpiarMensaje() {
  mensaje.textContent = "";
  mensaje.hidden = true;
}

async function cargarBotellas() {
  try {
    botella.disabled = true;
    botella.innerHTML = '<option value="">Cargando botellas...</option>';

    const data = await listarBotellas();
    botella.innerHTML = "";

    if (!data.length) {
      botella.innerHTML = '<option value="">No hay botellas registradas</option>';
      mostrarMensaje("Primero registra una botella para poder calcular tragos.", "info");
      return;
    }

    data.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.nombre;
      opt.dataset.pesoVacio = b.pesoVacio;
      opt.dataset.densidad = b.densidad;
      botella.appendChild(opt);
    });

    limpiarMensaje();
  } catch (error) {
    botella.innerHTML = '<option value="">Error al cargar</option>';
    mostrarMensaje(error.message);
  } finally {
    botella.disabled = false;
  }
}

function calcularTragos() {
  limpiarMensaje();

  const opcion = botella.selectedOptions[0];
  const pesoVacio = Number(opcion?.dataset.pesoVacio);
  const densidad = Number(opcion?.dataset.densidad);
  const pesoActualValor = Number(pesoActual.value);
  const tamTragoValor = Number(tamTrago.value);

  if (!opcion?.value) {
    mostrarMensaje("Selecciona una botella.");
    return;
  }

  if (!Number.isFinite(pesoActualValor) || pesoActualValor <= 0) {
    mostrarMensaje("Ingresa un peso actual valido.");
    return;
  }

  if (!Number.isFinite(tamTragoValor) || tamTragoValor <= 0) {
    mostrarMensaje("Ingresa un tamaño de trago valido.");
    return;
  }

  if (pesoActualValor < pesoVacio) {
    mostrarMensaje("El peso actual no puede ser menor que el peso vacio.");
    return;
  }

  const resultado = calcularTragosDisponibles({
    pesoActual: pesoActualValor,
    pesoVacio,
    densidad,
    tamanoTrago: tamTragoValor
  });

  pesoLicor.textContent = resultado.pesoLicor.toFixed(2);
  tragosDecimales.textContent = resultado.totalTragos.toFixed(2);
  tragosFraccion.textContent = resultado.tragosFraccion;
}

btnCalcular.addEventListener("click", calcularTragos);

cargarBotellas();
