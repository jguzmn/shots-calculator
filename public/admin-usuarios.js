import { crearUsuario, listarClientes, listarUsuarios, resetearPasswordUsuario } from "./admin-api.js";
import { configurarCerrarSesion, requerirSesion } from "./auth-client.js";

const mensaje = document.getElementById("mensaje");
const tabla = document.querySelector("#tablaUsuarios tbody");
const clienteId = document.getElementById("clienteId");
const nombre = document.getElementById("nombre");
const email = document.getElementById("email");
const rol = document.getElementById("rol");
const password = document.getElementById("password");
const btnCrearUsuario = document.getElementById("btnCrearUsuario");

function mostrarMensaje(texto, tipo = "error") {
  mensaje.textContent = texto;
  mensaje.className = `message message-${tipo}`;
  mensaje.hidden = false;
}

function limpiarMensaje() {
  mensaje.textContent = "";
  mensaje.hidden = true;
}

function cargarOpcionesClientes(clientes) {
  clienteId.innerHTML = "";
  clientes.forEach((cliente) => {
    const opt = document.createElement("option");
    opt.value = cliente.id;
    opt.textContent = cliente.nombre;
    clienteId.appendChild(opt);
  });
}

function agregarCelda(fila, texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  fila.appendChild(td);
  return td;
}

function renderUsuarios(usuarios) {
  tabla.innerHTML = "";

  if (!usuarios.length) {
    tabla.innerHTML = '<tr><td colspan="6">No hay usuarios registrados.</td></tr>';
    return;
  }

  usuarios.forEach((usuario) => {
    const tr = document.createElement("tr");
    agregarCelda(tr, usuario.nombre);
    agregarCelda(tr, usuario.email);
    agregarCelda(tr, usuario.clienteNombre);
    agregarCelda(tr, usuario.rol);
    agregarCelda(tr, usuario.activo ? "Activo" : "Inactivo");

    const acciones = agregarCelda(tr, "");
    acciones.className = "table-actions";
    const btnReset = document.createElement("button");
    btnReset.type = "button";
    btnReset.className = "button button-secondary";
    btnReset.textContent = "Reset password";
    btnReset.addEventListener("click", async () => {
      const nuevoPassword = window.prompt(`Nueva contraseña para ${usuario.email}`);

      if (!nuevoPassword) return;

      try {
        await resetearPasswordUsuario(usuario.id, nuevoPassword);
        mostrarMensaje("Contraseña actualizada correctamente.", "success");
      } catch (error) {
        mostrarMensaje(error.message);
      }
    });
    acciones.append(btnReset);
    tabla.appendChild(tr);
  });
}

async function cargarDatos() {
  const [clientes, usuarios] = await Promise.all([listarClientes(), listarUsuarios()]);
  cargarOpcionesClientes(clientes);
  renderUsuarios(usuarios);
}

btnCrearUsuario.addEventListener("click", async () => {
  limpiarMensaje();

  try {
    btnCrearUsuario.disabled = true;
    await crearUsuario({
      clienteId: Number(clienteId.value),
      nombre: nombre.value,
      email: email.value,
      rol: rol.value,
      password: password.value
    });
    nombre.value = "";
    email.value = "";
    password.value = "";
    mostrarMensaje("Usuario creado correctamente.", "success");
    await cargarDatos();
  } catch (error) {
    mostrarMensaje(error.message);
  } finally {
    btnCrearUsuario.disabled = false;
  }
});

async function iniciar() {
  const session = await requerirSesion();

  if (!session) return;

  if (session.user.rol !== "super_admin") {
    mostrarMensaje("No tienes permisos para administrar usuarios.");
    return;
  }

  configurarCerrarSesion();
  document.querySelectorAll(".admin-only").forEach((item) => {
    item.hidden = false;
  });
  await cargarDatos();
}

iniciar();
