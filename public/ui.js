export function crearModalAccion({
  modal,
  titulo,
  mensaje,
  passwordField,
  passwordInput,
  cancelar,
  confirmar
}) {
  return function abrirModalAccion({
    titulo: textoTitulo,
    mensaje: textoMensaje,
    requierePassword = false,
    confirmarTexto = "Confirmar"
  }) {
    return new Promise((resolve) => {
      titulo.textContent = textoTitulo;
      mensaje.textContent = textoMensaje;
      passwordInput.value = "";
      passwordField.hidden = !requierePassword;
      confirmar.textContent = confirmarTexto;
      modal.hidden = false;

      const cerrar = (valor) => {
        modal.hidden = true;
        cancelar.onclick = null;
        confirmar.onclick = null;
        resolve(valor);
      };

      cancelar.onclick = () => cerrar(null);
      confirmar.onclick = () => cerrar(requierePassword ? passwordInput.value : true);

      if (requierePassword) {
        passwordInput.focus();
      } else {
        confirmar.focus();
      }
    });
  };
}
