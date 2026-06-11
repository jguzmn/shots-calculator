# Plan de Evolucion del Proyecto

## Proposito

La aplicacion actual es una calculadora de tragos para estimar cuantas porciones quedan en una botella a partir de su peso actual, peso vacio, densidad del licor y tamano del trago.

El objetivo de la nueva version es convertir este prototipo en una herramienta web mas profesional, preparada para demostraciones comerciales y, en una etapa posterior, para operar como portal con clientes, usuarios y roles.

La interfaz y los textos visibles para usuarios finales deben mantenerse en espanol.

## Estado Actual

El proyecto funciona como una aplicacion estatica con:

- HTML, CSS y JavaScript vanilla.
- API Node.js/Express.
- Neon Postgres como base de datos.
- Una pantalla principal de calculadora.
- Una pantalla de administracion de botellas.
- Un formulario para crear y editar botellas.
- Una tabla principal `botellas` en Neon.

## Problemas Detectados

- La interfaz es funcional, pero todavia se ve como prototipo.
- Hay textos con problemas de codificacion, por ejemplo caracteres acentuados corruptos.
- La configuracion de base de datos debe vivir solo en el backend.
- La validacion usa `alert()` y `confirm()`, lo que limita la experiencia profesional.
- No hay estados visuales consistentes para carga, error, exito o datos vacios.
- No existe una estructura preparada para autenticacion, clientes, permisos o multiples organizaciones.
- La logica de calculo esta mezclada con manipulacion directa del DOM.
- No hay documentacion de configuracion, despliegue o modelo de datos.

## Principios de Refactor

- Mantener la aplicacion funcionando en cada etapa.
- Priorizar una mejora visible y demostrable antes de agregar complejidad.
- Mantener todo texto de interfaz en espanol.
- Separar calculos, acceso a datos y presentacion.
- Preparar el camino para autenticacion y multiples clientes sin construirlo todo desde el inicio.
- Evitar cambios grandes de arquitectura hasta que el flujo actual este limpio y estable.

## Etapa 1: Limpieza y Estabilizacion

Objetivo: mejorar la base actual sin cambiar el alcance funcional principal.

Entregables:

- Corregir problemas de codificacion en textos en espanol.
- Centralizar configuracion de base de datos en el backend.
- Extraer la logica de calculo a funciones reutilizables.
- Mejorar validaciones de formulario.
- Reemplazar alertas del navegador por mensajes visibles en la interfaz.
- Revisar consistencia de nombres de campos, por ejemplo `pesovacio` y `pesoVacio`.
- Agregar documentacion inicial en `README.md`.
- Confirmar que las pantallas actuales siguen funcionando.

Resultado esperado:

- Aplicacion actual mas clara, estable y facil de mantener.

## Etapa 2: Rediseño Visual Profesional

Objetivo: transformar la experiencia visual para que pueda usarse en una demostracion comercial.

Entregables:

- Nuevo layout para la calculadora.
- Nuevo layout para la administracion de botellas.
- Nuevo formulario de alta/edicion de botellas.
- Sistema visual consistente: colores, tipografia, espaciado, botones, inputs y tablas.
- Diseno responsivo para escritorio, tablet y movil.
- Estados de carga, error, exito y tabla vacia.
- Navegacion mas clara entre calculadora y administracion.
- Textos de interfaz revisados en espanol.

Resultado esperado:

- Demo visualmente mas profesional sin cambiar todavia el modelo de negocio.

## Etapa 3: Fundacion Tecnica para Crecimiento

Objetivo: preparar el proyecto para evolucionar de aplicacion estatica a portal.

Opcion recomendada:

- Vite
- React
- TypeScript
- API Node.js
- Neon Postgres

Entregables:

- Estructura moderna de proyecto.
- Variables de entorno para configuracion de Neon.
- Componentes reutilizables.
- Rutas internas para calculadora, botellas y futuras secciones.
- Capa de servicios para acceso a datos.
- Pruebas unitarias para la logica de calculo.
- Preparacion para despliegue web.

Resultado esperado:

- Codigo mas escalable y preparado para funcionalidades avanzadas.

## Etapa 4: Autenticacion y Roles

Objetivo: permitir acceso controlado a usuarios.

Roles iniciales propuestos:

- `super_admin`: administra todo el portal.
- `admin_cliente`: administra configuracion y usuarios de un cliente.
- `usuario_cliente`: usa la calculadora y consulta datos permitidos.

Entregables:

- Login con proveedor de autenticacion por definir.
- Tabla de perfiles de usuario.
- Proteccion de rutas.
- Visibilidad de pantallas segun rol.
- Politicas de acceso a datos por cliente y rol.

Resultado esperado:

- Portal con acceso seguro y base para multiples clientes.

## Etapa 5: Gestion de Clientes

Objetivo: convertir la aplicacion en una solucion multi-cliente.

Entregables:

- Tabla `clientes`.
- Asociacion de usuarios a clientes.
- Catalogo de botellas por cliente.
- Posible catalogo base/global de botellas.
- Pantalla para crear y editar clientes.
- Pantalla para administrar usuarios por cliente.
- Campos de auditoria: creado por, actualizado por, fechas.

Resultado esperado:

- Portal preparado para operar con varios clientes desde una misma plataforma.

## Etapa 6: Preparacion Productiva

Objetivo: dejar el producto listo para uso real.

Entregables:

- Despliegue en hosting web.
- Migraciones de base de datos.
- Documentacion de instalacion y operacion.
- Estrategia de respaldo o exportacion de datos.
- Registro basico de errores.
- Revision de seguridad de claves y permisos.
- Flujo de soporte para alta de clientes.

Resultado esperado:

- Producto listo para pruebas piloto o venta inicial.

## Primer Hito Recomendado

El primer hito debe combinar la Etapa 1 y una primera version de la Etapa 2.

Alcance:

- Mantener la aplicacion como HTML, CSS y JavaScript vanilla por ahora.
- Corregir textos y codificacion.
- Ordenar configuracion y logica compartida.
- Redisenar la calculadora.
- Redisenar la administracion de botellas.
- Mejorar formularios, validaciones y mensajes.
- Mantener Neon como fuente de datos mediante la API backend.

Criterio de exito:

- La aplicacion se puede mostrar a un potencial cliente con una interfaz mas profesional, sin perder funcionalidad existente.

## Progreso

### Etapa 1 iniciada

Decisiones aplicadas:

- La base de datos principal pasa de Supabase a Neon Postgres.
- La cadena de conexion de Neon no debe vivir en JavaScript del navegador.
- Se agrega una API Node.js para leer `DATABASE_URL` desde variables de entorno.
- La interfaz continua en espanol.
- La pantalla de calculadora y administracion de botellas consumen `/api/botellas`.
- La logica de calculo se separa en un modulo reutilizable.
- La confirmacion de eliminacion de botellas deja de depender de `confirm()` del navegador.

### Etapa 2 iniciada

Avances aplicados:

- Se agrega una cabecera comun tipo portal.
- Se define navegacion principal entre Calculadora y Botellas.
- La calculadora pasa a un layout de paneles con resultados separados.
- La administracion de botellas pasa a una vista de tabla con mejor jerarquia visual.
- El formulario de botellas se rediseña con estructura consistente.
- Se corrigen textos visibles de la interfaz en espanol.
- Se selecciona `BarraExacta` como nombre comercial.

### Preparacion de despliegue temporal

Avances aplicados:

- Los archivos estaticos pasan a `public/`.
- La API Express queda exportable para Vercel.
- Se agrega una entrada serverless `api/[...path].js` para rutas `/api/*`.
- Se agrega configuracion inicial `vercel.json`.
- La variable `DATABASE_URL` debera configurarse como variable de entorno en Vercel.

### Login demo

Avances aplicados:

- Se agrega tabla `usuarios` para acceso basico.
- Se agrega usuario tipo `demo` mediante script.
- Las contrasenas se guardan con hash PBKDF2.
- Se agrega cookie de sesion `HttpOnly` firmada con `SESSION_SECRET`.
- Se agregan endpoints `/api/auth/login`, `/api/auth/logout` y `/api/auth/me`.
- Las rutas `/api/botellas` requieren sesion.
- La interfaz agrega pantalla `login.html` y boton de cerrar sesion.

### Piloto profesional

Avances aplicados:

- Se agrega tabla `clientes`.
- El usuario demo queda asociado a un cliente demo.
- Las botellas operativas quedan asociadas a `cliente_id`.
- La API de botellas filtra datos por cliente de la sesion.
- Se agrega tabla `mediciones` para historial operativo.
- Cada calculo registra una medicion con botella, usuario, peso actual, tamano de trago y resultado.
- Se agrega pantalla `historial.html` para consultar mediciones recientes.
- Se agrega exportacion CSV de mediciones.

Pendientes posteriores:

- Panel para crear clientes desde la interfaz.
- Copiar catalogo base a un cliente desde la interfaz.
- Roles diferenciados entre admin de cliente y usuario operativo.
- Filtros de historial por fecha y botella.
- Configuracion visual por cliente.

## Pendientes por Definir

### Nombre comercial del producto

Decision:

- El nombre comercial seleccionado es `BarraExacta`.

Opciones consideradas:

- TragoControl
- BarraExacta
- Inventario Bar
- Medidor de Tragos
- Barra Clara
- PourMetric
- BarStock

Nota: antes de elegir un nombre final se debe validar disponibilidad de dominio, redes sociales y posibles conflictos de marca.

### Identidad visual o lineamientos de marca

Decision inicial:

- El producto debe funcionar como marca blanca.
- En una etapa futura cada cliente podria personalizar logo y un tema basico de colores.
- La primera version debe tener una identidad neutral, profesional y facil de adaptar.

Implicacion tecnica futura:

- Guardar configuracion visual por cliente.
- Permitir logo, color primario y color secundario.
- Mantener limites de contraste y legibilidad para evitar temas poco usables.

### Reglas exactas de calculo

Decision inicial:

- Se mantiene la formula actual.
- El usuario puede cambiar el tamano del trago.
- La densidad se mantiene editable por botella.
- La densidad puede venir predefinida en `1` por facilidad operativa.

Formula actual:

```text
peso_licor = peso_actual - peso_vacio
tragos = peso_licor / (densidad * tamano_trago)
```

### Catalogo de botellas por cliente

Decision inicial:

- Cada cliente tendra su propio catalogo de botellas.
- Se podra ofrecer un catalogo base como punto de partida.
- Una vez asignado o importado, el catalogo sera propio del cliente.
- Se recupera un catalogo base inicial desde el backup anterior de Supabase y se normalizan los nombres antes de importarlo.

Implicacion tecnica futura:

- La tabla `botellas` debera asociarse a `cliente_id`.
- Podria existir una tabla de plantillas o catalogo base global, inicialmente `catalogo_botellas_base`.
- La importacion de catalogo base deberia copiar datos al espacio del cliente, no compartirlos directamente.

### Historial de mediciones

Estado: no definido.

Se considera funcionalidad futura. Puede aportar valor si el producto evoluciona hacia inventario, control operativo o auditoria de consumo.

Posibles datos:

- Botella medida.
- Peso actual.
- Tragos calculados.
- Usuario que registro la medicion.
- Fecha y hora.
- Local o ubicacion, si se agrega soporte por local.

### Reportes y exportaciones

Estado: no definido.

Se considera funcionalidad futura.

Posibles reportes:

- Botellas registradas por cliente.
- Mediciones por periodo.
- Cambios de inventario.
- Consumo estimado.
- Exportacion CSV o Excel.

### Modelo comercial

Decision inicial:

- El modelo principal sera por cliente.
- En una etapa futura puede evaluarse funcionalidad por local.

Implicacion de producto:

- La estructura base debe contemplar `clientes`.
- La estructura futura podria contemplar `locales` asociados a un cliente.
- Las funcionalidades por local tendrian sentido si el producto crece hacia inventario mas integral o historial operativo.
