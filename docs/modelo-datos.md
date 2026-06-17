# Modelo de Datos - BarraExacta

Este documento resume las tablas principales, relaciones y reglas de datos vigentes para la etapa de piloto profesional.

## Principios

- Toda informacion operativa pertenece a un cliente mediante `cliente_id`.
- El frontend no define el cliente de una operacion; el backend lo toma desde la sesion.
- Los registros historicos no se eliminan.
- Las entidades con historial usan baja logica con `activo = false`.
- Los listados operativos muestran solo registros activos.

## clientes

Representa una organizacion o cliente comercial.

Campos principales:

- `id`
- `nombre`
- `slug`
- `activo`
- `tamano_trago_default`
- `created_at`
- `updated_at`

Reglas:

- `slug` debe ser unico.
- Un cliente inactivo no debe permitir login de sus usuarios.
- En etapa futura puede recibir configuracion visual de marca blanca.

## usuarios

Representa usuarios que ingresan al portal.

Campos principales:

- `id`
- `cliente_id`
- `email`
- `nombre`
- `rol`
- `password_hash`
- `activo`
- `created_at`
- `updated_at`

Roles vigentes:

- `super_admin`: administra la plataforma.
- `admin_cliente`: administra usuarios y catalogo de su cliente.
- `usuario_cliente`: opera calculadora e historial.
- `solo_lectura`: reservado para consulta de reportes.
- `demo`: usuario temporal con permisos controlados para demostraciones.

Reglas:

- `email` es unico sin distinguir mayusculas.
- Las contrasenas se guardan con hash PBKDF2.
- Si un usuario tiene mediciones, la eliminacion administrativa lo deja inactivo.
- Si no tiene historial, puede eliminarse fisicamente.

## botellas

Representa el catalogo operativo de botellas de cada cliente.

Campos principales:

- `id`
- `cliente_id`
- `nombre`
- `pesovacio`
- `densidad`
- `activo`
- `categoria`
- `volumen_ml`
- `created_at`
- `updated_at`

Reglas:

- El nombre de botella es unico por cliente sin distinguir mayusculas.
- Solo se listan botellas activas para calculadora y catalogo operativo.
- Si una botella tiene mediciones, el retiro se maneja con baja logica.
- Si no tiene mediciones, se puede eliminar fisicamente.

## mediciones

Representa el historial operativo generado por la calculadora.

Campos principales:

- `id`
- `cliente_id`
- `botella_id`
- `usuario_id`
- `peso_actual`
- `tamano_trago`
- `peso_licor`
- `tragos_decimales`
- `tragos_fraccion`
- `created_at`

Reglas:

- Cada medicion queda asociada a cliente, botella y usuario.
- No se eliminan mediciones desde la aplicacion.
- Los reportes deben poder consultar mediciones aunque la botella o el usuario esten inactivos.

## catalogo_botellas_base

Representa un catalogo reutilizable para iniciar clientes.

Campos principales:

- `id`
- `nombre`
- `pesovacio`
- `densidad`
- `activo`
- `created_at`
- `updated_at`

Reglas:

- El catalogo base no se comparte directamente con clientes.
- Cuando se asigna a un cliente, se copia a `botellas` como catalogo propio.

