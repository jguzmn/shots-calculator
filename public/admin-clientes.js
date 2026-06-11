import { copiarCatalogoBase, crearCliente, listarClientes } from "./admin-api.js";
import { configurarCerrarSesion, requerirSesion } from "./auth-client.js";

const mensaje = document.getElementById("mensaje");
const adminWorkspace = document.getElementById("adminWorkspace");
const tabla = document.querySelector("#tablaClientes tbody");
const nombre = document.getElementById("nombre");
const slug = document.getElementById("slug");
const tamanoTragoDefault = document.getElementById("tamanoTragoDefault");
const copiarCatalogoBaseInput = document.getElementById("copiarCatalogoBase");
const btnCrearCliente = document.getElementById("btnCrearCliente");

function mostrarMensaje(texto, tipo = "error") {
  mensaje.textContent = texto;
  mensaje.className = `message message-${tipo}`;
  mensaje.hidden = false;
}

function limpiarMensaje() {
  mensaje.textContent = "";
  mensaje.hidden = true;
}

function agregarCelda(fila, texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  fila.appendChild(td);
  return td;
}

function renderClientes(clientes) {
  tabla.innerHTML = "";

  if (!clientes.length) {
    tabla.innerHTML = '<tr><td colspan="6">No hay clientes registrados.</td></tr>';
    return;
  }

  clientes.forEach((cliente) => {
    const tr = document.createElement("tr");
    agregarCelda(tr, cliente.nombre);
    agregarCelda(tr, cliente.slug);
    agregarCelda(tr, cliente.activo ? "Activo" : "Inactivo");
    agregarCelda(tr, cliente.totalUsuarios);
    agregarCelda(tr, cliente.totalBotellas);

    const acciones = agregarCelda(tr, "");
    acciones.className = "table-actions";
    const btnCatalogo = document.createElement("button");
    btnCatalogo.type = "button";
    btnCatalogo.className = "button button-secondary";
    btnCatalogo.textContent = "Copiar catalogo";
    btnCatalogo.addEventListener("click", async () => {
      try {
        await copiarCatalogoBase(cliente.id);
        mostrarMensaje("Catálogo base copiado correctamente.", "success");
        await cargarClientes();
      } catch (error) {
        mostrarMensaje(error.message);
      }
    });
    acciones.append(btnCatalogo);
    tabla.appendChild(tr);
  });
}

async function cargarClientes() {
  try {
    tabla.innerHTML = '<tr><td colspan="6">Cargando clientes...</td></tr>';
    renderClientes(await listarClientes());
  } catch (error) {
    tabla.innerHTML = "";
    mostrarMensaje(error.message);
  }
}

btnCrearCliente.addEventListener("click", async () => {
  limpiarMensaje();

  try {
    btnCrearCliente.disabled = true;
    await crearCliente({
      nombre: nombre.value,
      slug: slug.value,
      tamanoTragoDefault: Number(tamanoTragoDefault.value),
      copiarCatalogoBase: copiarCatalogoBaseInput.checked
    });
    nombre.value = "";
    slug.value = "";
    tamanoTragoDefault.value = "60";
    mostrarMensaje("Cliente creado correctamente.", "success");
    await cargarClientes();
  } catch (error) {
    mostrarMensaje(error.message);
  } finally {
    btnCrearCliente.disabled = false;
  }
});

async function iniciar() {
  const session = await requerirSesion();

  if (!session) return;

  if (session.user.rol !== "super_admin") {
    window.location.href = "index.html";
    return;
  }

  configurarCerrarSesion();
  document.querySelectorAll(".admin-only").forEach((item) => {
    item.hidden = false;
  });
  adminWorkspace.hidden = false;
  await cargarClientes();
}

iniciar();
