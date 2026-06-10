import { eliminarBotella, listarBotellas } from "./api-client.js";

const tabla = document.querySelector("#tablaBotellas tbody");
const btnNueva = document.getElementById("btnNueva");
const mensaje = document.getElementById("mensaje");
let botellasActuales = [];
let botellaPendienteEliminar = null;

function mostrarMensaje(texto, tipo = "error") {
  mensaje.textContent = texto;
  mensaje.className = `message message-${tipo}`;
  mensaje.hidden = false;
}

function limpiarMensaje() {
  mensaje.textContent = "";
  mensaje.hidden = true;
}

btnNueva.addEventListener("click", () => {
  window.location.href = "botella-form.html";
});

async function cargarBotellas() {
  try {
    limpiarMensaje();
    tabla.innerHTML = '<tr><td colspan="4">Cargando botellas...</td></tr>';
    const data = await listarBotellas();
    botellasActuales = data;
    botellaPendienteEliminar = null;
    renderBotellas(data);
  } catch (error) {
    tabla.innerHTML = "";
    mostrarMensaje(error.message);
  }
}

function renderBotellas(lista) {
  tabla.innerHTML = "";

  if (!lista.length) {
    tabla.innerHTML = '<tr><td colspan="4">No hay botellas registradas.</td></tr>';
    return;
  }

  lista.forEach((b) => {
    const tr = document.createElement("tr");

    const nombre = document.createElement("td");
    nombre.textContent = b.nombre;

    const pesoVacio = document.createElement("td");
    pesoVacio.textContent = b.pesoVacio;

    const densidad = document.createElement("td");
    densidad.textContent = b.densidad;

    const acciones = document.createElement("td");
    acciones.className = "table-actions";

    renderAcciones(acciones, b);
    tr.append(nombre, pesoVacio, densidad, acciones);
    tabla.appendChild(tr);
  });
}

function renderAcciones(contenedor, botella) {
  contenedor.innerHTML = "";

  if (botellaPendienteEliminar === botella.id) {
    const btnConfirmar = document.createElement("button");
    btnConfirmar.className = "btnConfirmar";
    btnConfirmar.type = "button";
    btnConfirmar.textContent = "Confirmar";

    const btnCancelar = document.createElement("button");
    btnCancelar.className = "btnCancelarInline";
    btnCancelar.type = "button";
    btnCancelar.textContent = "Cancelar";

    btnConfirmar.addEventListener("click", async () => {
      try {
        await eliminarBotella(botella.id);
        mostrarMensaje("Botella eliminada correctamente.", "success");
        await cargarBotellas();
      } catch (error) {
        mostrarMensaje(error.message);
      }
    });

    btnCancelar.addEventListener("click", () => {
      botellaPendienteEliminar = null;
      renderBotellas(botellasActuales);
    });

    contenedor.append(btnConfirmar, btnCancelar);
    return;
  }

  const btnEditar = document.createElement("button");
  btnEditar.className = "btnEditar";
  btnEditar.type = "button";
  btnEditar.textContent = "Editar";

  const btnEliminar = document.createElement("button");
  btnEliminar.className = "btnEliminar";
  btnEliminar.type = "button";
  btnEliminar.textContent = "Eliminar";

  btnEditar.addEventListener("click", () => {
    window.location.href = `botella-form.html?id=${botella.id}`;
  });

  btnEliminar.addEventListener("click", () => {
    botellaPendienteEliminar = botella.id;
    mostrarMensaje(`Confirma la eliminación de "${botella.nombre}".`, "info");
    renderBotellas(botellasActuales);
  });

  contenedor.append(btnEditar, btnEliminar);
}

cargarBotellas();
