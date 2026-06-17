import {
  actualizarUsuario,
  crearUsuario,
  eliminarUsuario,
  listarClientes,
  listarUsuarios,
  resetearPasswordUsuario
} from "./admin-api.js";
import {
  configurarCerrarSesion,
  configurarNavegacionAdmin,
  puedeAdministrarUsuarios,
  requerirSesion
} from "./auth-client.js";
import { crearModalAccion } from "./ui.js";

const mensaje = document.getElementById("mensaje");
const adminWorkspace = document.getElementById("adminWorkspace");
const tabla = document.querySelector("#tablaUsuarios tbody");
const tituloFormularioUsuario = document.getElementById("tituloFormularioUsuario");
const clienteId = document.getElementById("clienteId");
const nombre = document.getElementById("nombre");
const email = document.getElementById("email");
const rol = document.getElementById("rol");
const password = document.getElementById("password");
const activo = document.getElementById("activo");
const btnCrearUsuario = document.getElementById("btnCrearUsuario");
const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
const modalConfirmacion = document.getElementById("modalConfirmacion");
const modalTitulo = document.getElementById("modalTitulo");
const modalMensaje = document.getElementById("modalMensaje");
const modalPasswordField = document.getElementById("modalPasswordField");
const modalPassword = document.getElementById("modalPassword");
const btnModalCancelar = document.getElementById("btnModalCancelar");
const btnModalConfirmar = document.getElementById("btnModalConfirmar");
const abrirModalAccion = crearModalAccion({
  modal: modalConfirmacion,
  titulo: modalTitulo,
  mensaje: modalMensaje,
  passwordField: modalPasswordField,
  passwordInput: modalPassword,
  cancelar: btnModalCancelar,
  confirmar: btnModalConfirmar
});

let usuarioEditandoId = null;

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

function configurarRolesPorSesion(session) {
  if (session.user.rol === "super_admin") {
    return;
  }

  const rolesPermitidos = ["admin_cliente", "usuario_cliente", "solo_lectura"];
  Array.from(rol.options).forEach((option) => {
    if (!rolesPermitidos.includes(option.value)) {
      option.remove();
    }
  });
}

function limpiarFormulario() {
  usuarioEditandoId = null;
  tituloFormularioUsuario.textContent = "Crear usuario";
  btnCrearUsuario.textContent = "Crear usuario";
  btnCancelarEdicion.hidden = true;
  clienteId.selectedIndex = 0;
  nombre.value = "";
  email.value = "";
  rol.value = "admin_cliente";
  password.value = "";
  password.disabled = false;
  password.placeholder = "";
  activo.checked = true;
}

function cargarUsuarioEnFormulario(usuario) {
  usuarioEditandoId = usuario.id;
  tituloFormularioUsuario.textContent = "Editar usuario";
  btnCrearUsuario.textContent = "Guardar cambios";
  btnCancelarEdicion.hidden = false;
  clienteId.value = usuario.clienteId;
  nombre.value = usuario.nombre;
  email.value = usuario.email;
  rol.value = usuario.rol;
  password.value = "";
  password.disabled = true;
  password.placeholder = "Usa Reset password para cambiarla";
  activo.checked = usuario.activo;
  limpiarMensaje();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function datosUsuarioDesdeFormulario() {
  return {
    clienteId: Number(clienteId.value),
    nombre: nombre.value,
    email: email.value,
    rol: rol.value,
    activo: activo.checked
  };
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

    const btnEditar = document.createElement("button");
    btnEditar.type = "button";
    btnEditar.className = "btnEditar button button-secondary";
    btnEditar.textContent = "Editar";
    btnEditar.addEventListener("click", () => cargarUsuarioEnFormulario(usuario));
    acciones.append(btnEditar);

    const btnEstado = document.createElement("button");
    btnEstado.type = "button";
    btnEstado.className = usuario.activo ? "btnEliminar" : "btnCancelarInline";
    btnEstado.textContent = usuario.activo ? "Inactivar" : "Activar";
    btnEstado.addEventListener("click", async () => {
      try {
        await actualizarUsuario(usuario.id, {
          clienteId: usuario.clienteId,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol,
          activo: !usuario.activo
        });
        mostrarMensaje(
          usuario.activo ? "Usuario inactivado correctamente." : "Usuario activado correctamente.",
          "success"
        );
        if (usuarioEditandoId === usuario.id) {
          limpiarFormulario();
        }
        await cargarDatos();
      } catch (error) {
        mostrarMensaje(error.message);
      }
    });
    acciones.append(btnEstado);

    const btnReset = document.createElement("button");
    btnReset.type = "button";
    btnReset.className = "button button-secondary";
    btnReset.textContent = "Reset password";
    btnReset.addEventListener("click", async () => {
      const nuevoPassword = await abrirModalAccion({
        titulo: "Resetear contraseña",
        mensaje: `Ingresa una nueva contraseña para ${usuario.email}.`,
        requierePassword: true,
        confirmarTexto: "Actualizar"
      });

      if (!nuevoPassword) return;

      try {
        await resetearPasswordUsuario(usuario.id, nuevoPassword);
        mostrarMensaje("Contraseña actualizada correctamente.", "success");
      } catch (error) {
        mostrarMensaje(error.message);
      }
    });
    acciones.append(btnReset);

    const btnEliminar = document.createElement("button");
    btnEliminar.type = "button";
    btnEliminar.className = "btnEliminar";
    btnEliminar.textContent = "Eliminar";
    btnEliminar.addEventListener("click", async () => {
      const confirmado = await abrirModalAccion({
        titulo: "Eliminar usuario",
        mensaje: `Eliminar usuario ${usuario.email}? Si tiene historial, quedara inactivo y no podra iniciar sesion.`,
        confirmarTexto: "Eliminar"
      });

      if (!confirmado) return;

      try {
        const resultado = await eliminarUsuario(usuario.id);
        mostrarMensaje(
          resultado?.bajaLogica
            ? "El usuario tiene historial y quedo inactivo."
            : "Usuario eliminado correctamente.",
          "success"
        );
        if (usuarioEditandoId === usuario.id) {
          limpiarFormulario();
        }
        await cargarDatos();
      } catch (error) {
        mostrarMensaje(error.message);
      }
    });
    acciones.append(btnEliminar);

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

    if (usuarioEditandoId) {
      await actualizarUsuario(usuarioEditandoId, datosUsuarioDesdeFormulario());
      mostrarMensaje("Usuario actualizado correctamente.", "success");
    } else {
      await crearUsuario({
        ...datosUsuarioDesdeFormulario(),
        password: password.value
      });
      mostrarMensaje("Usuario creado correctamente.", "success");
    }

    limpiarFormulario();
    await cargarDatos();
  } catch (error) {
    mostrarMensaje(error.message);
  } finally {
    btnCrearUsuario.disabled = false;
  }
});

btnCancelarEdicion.addEventListener("click", () => {
  limpiarMensaje();
  limpiarFormulario();
});

async function iniciar() {
  const session = await requerirSesion();

  if (!session) return;

  if (!puedeAdministrarUsuarios(session)) {
    window.location.href = "index.html";
    return;
  }

  configurarCerrarSesion();
  configurarRolesPorSesion(session);
  configurarNavegacionAdmin(session);
  adminWorkspace.hidden = false;
  await cargarDatos();
}

iniciar();
