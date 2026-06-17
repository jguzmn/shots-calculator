# Decisiones Tecnicas - BarraExacta

Este documento registra decisiones vigentes, motivos y pendientes relevantes.

## Mantener frontend vanilla JS

Decision:

- Mantener HTML, CSS y JavaScript vanilla durante piloto profesional.

Motivo:

- El flujo principal todavia es controlado.
- Evita migracion prematura a React/Vite.
- Permite avanzar rapido en validacion comercial.

Pendiente:

- Revaluar React/Vite cuando haya mas pantallas, formularios complejos, dashboards o pilotos validados.

## Backend Express en Vercel

Decision:

- Usar `server.js` como app Express y `api/[...path].js` como entrada serverless.

Motivo:

- Permite desarrollo local simple.
- Mantiene compatibilidad con Vercel.
- Evita duplicar rutas entre local y produccion.

Pendiente:

- Separar progresivamente rutas, servicios, middleware y conexion DB cuando el archivo crezca mas.

## Neon Postgres

Decision:

- Usar Neon Postgres como base de datos principal.

Motivo:

- Postgres es suficiente para multi-cliente, historial y reportes.
- Neon facilita despliegue temprano y operacion administrada.

Pendiente:

- Definir estrategia formal de backups y restauracion antes de venta recurrente.

## Sesion por cookie firmada

Decision:

- Usar cookie `HttpOnly` firmada para sesion.

Motivo:

- Es suficiente para piloto privado.
- Evita exponer token legible desde JavaScript.

Pendiente:

- Agregar recuperacion de contrasena, rate limiting de login y auditoria.

## Baja logica con historial

Decision:

- Usuarios y botellas con historial no se eliminan fisicamente.
- Se dejan inactivos para preservar trazabilidad.

Motivo:

- Las mediciones son registros historicos.
- Eliminar entidades usadas en historial rompe reportes y auditoria.

Pendiente:

- Agregar vistas de registros inactivos y restauracion controlada.

## Roles

Decision:

- `super_admin` administra plataforma.
- `admin_cliente` administra usuarios y catalogo de su cliente.
- `usuario_cliente` opera calculadora e historial.
- `solo_lectura` queda reservado para reportes.
- `demo` queda como rol temporal para demostraciones controladas.

Motivo:

- El producto necesita permisos reales antes de pilotos.
- La separacion por cliente debe cumplirse en backend.

Pendiente:

- Definir permisos finales de `solo_lectura`.
- Evaluar si `demo` debe desaparecer antes de ventas reales.

## Filtros de historial

Decision:

- Agregar filtros iniciales por botella y rango de fechas.

Motivo:

- Mejora el valor comercial del historial sin construir reportes complejos.
- El CSV debe respetar los filtros visibles.

Pendiente:

- Agregar filtros por usuario y resumen ejecutivo por periodo.

