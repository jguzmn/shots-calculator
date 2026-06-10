# Shots Calculator

Aplicacion web en espanol para calcular tragos restantes en una botella a partir del peso actual, peso vacio, densidad y tamano del trago.

## Stack actual

- Node.js
- Express
- Neon Postgres
- HTML, CSS y JavaScript vanilla

## Configuracion local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env` a partir de `.env.example`:

```bash
DATABASE_URL=postgresql://usuario:password@host/neondb?sslmode=require
PORT=3000
```

La variable `DATABASE_URL` es secreta y no debe subirse al repositorio.

3. Iniciar el servidor:

```bash
npm run dev
```

4. Abrir:

```text
http://localhost:3000
```

## Cargar datos iniciales

Para importar el contenido de `botellas.json` en Neon:

```bash
npm run seed
```

Para importar el catalogo base recuperado del backup de Supabase en una tabla separada:

```bash
npm run import:catalogo-base
```

Este comando crea o actualiza `catalogo_botellas_base`. No modifica la tabla operativa `botellas`.

## Base de datos

Al iniciar, el servidor crea la tabla `botellas` si no existe.

Campos principales:

- `id`
- `nombre`
- `pesovacio`
- `densidad`
- `created_at`
- `updated_at`

La tabla `catalogo_botellas_base` se reserva para ofrecer un catalogo inicial a futuros clientes.

## Endpoints

- `GET /api/health`
- `GET /api/botellas`
- `GET /api/botellas/:id`
- `POST /api/botellas`
- `PUT /api/botellas/:id`
- `DELETE /api/botellas/:id`

## Nota de seguridad

La conexion a Neon se hace desde el backend. El navegador nunca debe recibir ni conocer la cadena de conexion de Postgres.
