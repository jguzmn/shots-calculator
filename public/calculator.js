export function convertirFraccion(valor) {
  const entero = Math.floor(valor);
  const fraccion = valor - entero;

  if (fraccion < 0.13) return `${entero}`;
  if (fraccion < 0.38) return `${entero} 1/4`;
  if (fraccion < 0.63) return `${entero} 1/2`;
  if (fraccion < 0.88) return `${entero} 3/4`;

  return `${entero + 1}`;
}

export function calcularTragos({ pesoActual, pesoVacio, densidad, tamanoTrago }) {
  const pesoLicor = pesoActual - pesoVacio;
  const totalTragos = pesoLicor / (densidad * tamanoTrago);

  return {
    pesoLicor,
    totalTragos,
    tragosFraccion: convertirFraccion(totalTragos)
  };
}
