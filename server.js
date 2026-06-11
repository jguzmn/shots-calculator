const path = require("node:path");
const express = require("express");
const { Pool } = require("pg");
const { hashPassword, signSession, verifyPassword, verifySession } = require("./lib/auth-utils");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const databaseUrl = process.env.DATABASE_URL;
const sessionSecret =
  process.env.SESSION_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "barraexacta-dev-session-secret");
const sessionCookieName = "barraexacta_session";
const sessionDurationMs = 12 * 60 * 60 * 1000;
const defaultClientName = process.env.DEMO_CLIENT_NAME || "Cliente Demo";
const defaultClientSlug = process.env.DEMO_CLIENT_SLUG || "demo";

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL. Crea un archivo .env basado en .env.example.");
}

if (!sessionSecret) {
  throw new Error("Falta SESSION_SECRET. Configuralo como variable de entorno.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

let schemaReady;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function mapBotella(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    pesoVacio: Number(row.pesovacio),
    densidad: Number(row.densidad)
  };
}

function mapMedicion(row) {
  return {
    id: row.id,
    botellaId: row.botella_id,
    botellaNombre: row.botella_nombre,
    usuarioNombre: row.usuario_nombre,
    pesoActual: Number(row.peso_actual),
    tamanoTrago: Number(row.tamano_trago),
    pesoLicor: Number(row.peso_licor),
    tragosDecimales: Number(row.tragos_decimales),
    tragosFraccion: row.tragos_fraccion,
    creadaEn: row.created_at
  };
}

function mapCliente(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    slug: row.slug,
    activo: row.activo,
    tamanoTragoDefault: Number(row.tamano_trago_default),
    totalUsuarios: Number(row.total_usuarios || 0),
    totalBotellas: Number(row.total_botellas || 0)
  };
}

function mapUsuario(row) {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    clienteNombre: row.cliente_nombre,
    email: row.email,
    nombre: row.nombre,
    rol: row.rol,
    activo: row.activo
  };
}

function validateBotella(input) {
  const nombre = String(input.nombre || "").trim();
  const pesoVacio = Number(input.pesoVacio);
  const densidad = Number(input.densidad);

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!Number.isFinite(pesoVacio) || pesoVacio <= 0) {
    return { error: "El peso vacío debe ser mayor que cero." };
  }
  if (!Number.isFinite(densidad) || densidad <= 0) {
    return { error: "La densidad debe ser mayor que cero." };
  }

  return { data: { nombre, pesoVacio, densidad } };
}

function convertirFraccion(valor) {
  const entero = Math.floor(valor);
  const fraccion = valor - entero;

  if (fraccion < 0.13) return `${entero}`;
  if (fraccion < 0.38) return `${entero} 1/4`;
  if (fraccion < 0.63) return `${entero} 1/2`;
  if (fraccion < 0.88) return `${entero} 3/4`;

  return `${entero + 1}`;
}

function escapeCsv(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      activo BOOLEAN NOT NULL DEFAULT true,
      tamano_trago_default NUMERIC(8, 2) NOT NULL DEFAULT 60,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    INSERT INTO clientes (nombre, slug)
    VALUES ('${defaultClientName.replace(/'/g, "''")}', '${defaultClientSlug.replace(/'/g, "''")}')
    ON CONFLICT (slug)
    DO UPDATE SET nombre = EXCLUDED.nombre, updated_at = now();

    CREATE TABLE IF NOT EXISTS botellas (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      pesovacio NUMERIC(10, 2) NOT NULL CHECK (pesovacio > 0),
      densidad NUMERIC(8, 4) NOT NULL CHECK (densidad > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE botellas ADD COLUMN IF NOT EXISTS cliente_id BIGINT;
    ALTER TABLE botellas ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
    ALTER TABLE botellas ADD COLUMN IF NOT EXISTS categoria TEXT;
    ALTER TABLE botellas ADD COLUMN IF NOT EXISTS volumen_ml NUMERIC(10, 2);

    CREATE TABLE IF NOT EXISTS usuarios (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'demo',
      password_hash TEXT NOT NULL,
      activo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cliente_id BIGINT;

    CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_lower_unique
      ON usuarios (lower(email));

    UPDATE botellas
    SET cliente_id = (SELECT id FROM clientes WHERE slug = '${defaultClientSlug.replace(/'/g, "''")}')
    WHERE cliente_id IS NULL;

    UPDATE usuarios
    SET cliente_id = (SELECT id FROM clientes WHERE slug = '${defaultClientSlug.replace(/'/g, "''")}')
    WHERE cliente_id IS NULL;

    ALTER TABLE botellas ALTER COLUMN cliente_id SET NOT NULL;
    ALTER TABLE usuarios ALTER COLUMN cliente_id SET NOT NULL;

    ALTER TABLE botellas DROP CONSTRAINT IF EXISTS botellas_nombre_key;

    CREATE UNIQUE INDEX IF NOT EXISTS botellas_cliente_nombre_lower_unique
      ON botellas (cliente_id, lower(nombre));

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'botellas_cliente_id_fkey'
      ) THEN
        ALTER TABLE botellas
          ADD CONSTRAINT botellas_cliente_id_fkey
          FOREIGN KEY (cliente_id) REFERENCES clientes(id);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_cliente_id_fkey'
      ) THEN
        ALTER TABLE usuarios
          ADD CONSTRAINT usuarios_cliente_id_fkey
          FOREIGN KEY (cliente_id) REFERENCES clientes(id);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS mediciones (
      id BIGSERIAL PRIMARY KEY,
      cliente_id BIGINT NOT NULL REFERENCES clientes(id),
      botella_id BIGINT NOT NULL REFERENCES botellas(id),
      usuario_id BIGINT NOT NULL REFERENCES usuarios(id),
      peso_actual NUMERIC(10, 2) NOT NULL CHECK (peso_actual >= 0),
      tamano_trago NUMERIC(8, 2) NOT NULL CHECK (tamano_trago > 0),
      peso_licor NUMERIC(10, 2) NOT NULL CHECK (peso_licor >= 0),
      tragos_decimales NUMERIC(10, 2) NOT NULL CHECK (tragos_decimales >= 0),
      tragos_fraccion TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS mediciones_cliente_created_at_idx
      ON mediciones (cliente_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS catalogo_botellas_base (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      pesovacio NUMERIC(10, 2) NOT NULL CHECK (pesovacio > 0),
      densidad NUMERIC(8, 4) NOT NULL CHECK (densidad > 0),
      activo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function ensureSchemaOnce() {
  if (!schemaReady) {
    schemaReady = ensureSchema();
  }

  return schemaReady;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, pair) => {
    const [name, ...valueParts] = pair.trim().split("=");

    if (name) {
      cookies[name] = decodeURIComponent(valueParts.join("="));
    }

    return cookies;
  }, {});
}

function getSessionCookieOptions() {
  const secure = process.env.NODE_ENV === "production";

  return [
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(sessionDurationMs / 1000)}`,
    secure ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");
}

function setSessionCookie(res, user) {
  const token = signSession(
    {
      sub: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      clienteId: user.cliente_id,
      clienteNombre: user.cliente_nombre,
      exp: Date.now() + sessionDurationMs
    },
    sessionSecret
  );

  res.setHeader("Set-Cookie", `${sessionCookieName}=${encodeURIComponent(token)}; ${getSessionCookieOptions()}`);
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return verifySession(cookies[sessionCookieName], sessionSecret);
}

function requireAuth(req, res, next) {
  const session = getSession(req);

  if (!session) {
    res.status(401).json({ message: "Debes iniciar sesión." });
    return;
  }

  req.user = session;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ message: "No tienes permisos para esta acción." });
      return;
    }

    next();
  };
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function copiarCatalogoBaseACliente(clienteId) {
  const { rows } = await pool.query(
    "SELECT nombre, pesovacio, densidad FROM catalogo_botellas_base WHERE activo = true ORDER BY nombre ASC"
  );

  for (const botella of rows) {
    const existing = await pool.query(
      "SELECT id FROM botellas WHERE cliente_id = $1 AND lower(nombre) = lower($2)",
      [clienteId, botella.nombre]
    );

    if (existing.rows.length) {
      await pool.query(
        `UPDATE botellas
         SET pesovacio = $1,
             densidad = $2,
             activo = true,
             updated_at = now()
         WHERE id = $3`,
        [botella.pesovacio, botella.densidad, existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO botellas (cliente_id, nombre, pesovacio, densidad)
         VALUES ($1, $2, $3, $4)`,
        [clienteId, botella.nombre, botella.pesovacio, botella.densidad]
      );
    }
  }
}

app.use("/api", asyncHandler(async (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  await ensureSchemaOnce();
  next();
}));

app.get("/api/health", asyncHandler(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
}));

app.get("/api/auth/me", (req, res) => {
  const session = getSession(req);

  if (!session) {
    res.status(401).json({ message: "No hay sesión activa." });
    return;
  }

  res.json({
    user: {
      id: session.sub,
      email: session.email,
      nombre: session.nombre,
      rol: session.rol,
      cliente: {
        id: session.clienteId,
        nombre: session.clienteNombre
      }
    }
  });
});

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    res.status(400).json({ message: "Ingresa correo y contraseña." });
    return;
  }

  const { rows } = await pool.query(
    `SELECT u.id,
            u.email,
            u.nombre,
            u.rol,
            u.password_hash,
            u.cliente_id,
            c.nombre AS cliente_nombre
     FROM usuarios u
     JOIN clientes c ON c.id = u.cliente_id
     WHERE lower(u.email) = lower($1)
       AND c.activo = true
       AND u.activo = true
     LIMIT 1`,
    [email]
  );

  const user = rows[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ message: "Correo o contraseña inválidos." });
    return;
  }

  setSessionCookie(res, user);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      cliente: {
        id: user.cliente_id,
        nombre: user.cliente_nombre
      }
    }
  });
}));

app.post("/api/auth/logout", (req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
});

app.use("/api/admin", requireAuth, requireRole("super_admin"));

app.get("/api/admin/clientes", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id,
            c.nombre,
            c.slug,
            c.activo,
            c.tamano_trago_default,
            COUNT(DISTINCT u.id) AS total_usuarios,
            COUNT(DISTINCT b.id) AS total_botellas
     FROM clientes c
     LEFT JOIN usuarios u ON u.cliente_id = c.id
     LEFT JOIN botellas b ON b.cliente_id = c.id
     GROUP BY c.id
     ORDER BY c.nombre ASC`
  );

  res.json(rows.map(mapCliente));
}));

app.post("/api/admin/clientes", asyncHandler(async (req, res) => {
  const nombre = String(req.body.nombre || "").trim();
  const slug = slugify(req.body.slug || nombre);
  const tamanoTragoDefault = Number(req.body.tamanoTragoDefault || 60);
  const copiarCatalogoBase = Boolean(req.body.copiarCatalogoBase);

  if (!nombre) {
    res.status(400).json({ message: "El nombre del cliente es obligatorio." });
    return;
  }

  if (!slug) {
    res.status(400).json({ message: "El slug del cliente no es válido." });
    return;
  }

  if (!Number.isFinite(tamanoTragoDefault) || tamanoTragoDefault <= 0) {
    res.status(400).json({ message: "El tamaño de trago por defecto no es válido." });
    return;
  }

  const { rows } = await pool.query(
    `INSERT INTO clientes (nombre, slug, tamano_trago_default)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, slug, activo, tamano_trago_default, 0 AS total_usuarios, 0 AS total_botellas`,
    [nombre, slug, tamanoTragoDefault]
  );

  if (copiarCatalogoBase) {
    await copiarCatalogoBaseACliente(rows[0].id);
  }

  res.status(201).json(mapCliente(rows[0]));
}));

app.put("/api/admin/clientes/:id", asyncHandler(async (req, res) => {
  const nombre = String(req.body.nombre || "").trim();
  const slug = slugify(req.body.slug || nombre);
  const activo = Boolean(req.body.activo);
  const tamanoTragoDefault = Number(req.body.tamanoTragoDefault || 60);

  if (!nombre || !slug) {
    res.status(400).json({ message: "Nombre y slug son obligatorios." });
    return;
  }

  const { rows } = await pool.query(
    `UPDATE clientes
     SET nombre = $1,
         slug = $2,
         activo = $3,
         tamano_trago_default = $4,
         updated_at = now()
     WHERE id = $5
     RETURNING id, nombre, slug, activo, tamano_trago_default, 0 AS total_usuarios, 0 AS total_botellas`,
    [nombre, slug, activo, tamanoTragoDefault, req.params.id]
  );

  if (!rows.length) {
    res.status(404).json({ message: "Cliente no encontrado." });
    return;
  }

  res.json(mapCliente(rows[0]));
}));

app.post("/api/admin/clientes/:id/copiar-catalogo-base", asyncHandler(async (req, res) => {
  await copiarCatalogoBaseACliente(req.params.id);
  res.status(204).send();
}));

app.get("/api/admin/usuarios", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id,
            u.cliente_id,
            c.nombre AS cliente_nombre,
            u.email,
            u.nombre,
            u.rol,
            u.activo
     FROM usuarios u
     JOIN clientes c ON c.id = u.cliente_id
     ORDER BY c.nombre ASC, u.nombre ASC`
  );

  res.json(rows.map(mapUsuario));
}));

app.post("/api/admin/usuarios", asyncHandler(async (req, res) => {
  const clienteId = Number(req.body.clienteId);
  const email = String(req.body.email || "").trim().toLowerCase();
  const nombre = String(req.body.nombre || "").trim();
  const rol = String(req.body.rol || "usuario_cliente").trim();
  const password = String(req.body.password || "");

  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    res.status(400).json({ message: "Selecciona un cliente válido." });
    return;
  }

  if (!email || !nombre || !password) {
    res.status(400).json({ message: "Correo, nombre y contraseña son obligatorios." });
    return;
  }

  if (!["super_admin", "admin_cliente", "usuario_cliente", "demo"].includes(rol)) {
    res.status(400).json({ message: "Rol inválido." });
    return;
  }

  const { rows } = await pool.query(
    `INSERT INTO usuarios (cliente_id, email, nombre, rol, password_hash, activo)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id, cliente_id, email, nombre, rol, activo`,
    [clienteId, email, nombre, rol, hashPassword(password)]
  );

  const client = await pool.query("SELECT nombre FROM clientes WHERE id = $1", [clienteId]);
  rows[0].cliente_nombre = client.rows[0]?.nombre || "";

  res.status(201).json(mapUsuario(rows[0]));
}));

app.put("/api/admin/usuarios/:id", asyncHandler(async (req, res) => {
  const clienteId = Number(req.body.clienteId);
  const email = String(req.body.email || "").trim().toLowerCase();
  const nombre = String(req.body.nombre || "").trim();
  const rol = String(req.body.rol || "usuario_cliente").trim();
  const activo = Boolean(req.body.activo);

  if (!Number.isInteger(clienteId) || clienteId <= 0 || !email || !nombre) {
    res.status(400).json({ message: "Cliente, correo y nombre son obligatorios." });
    return;
  }

  if (!["super_admin", "admin_cliente", "usuario_cliente", "demo"].includes(rol)) {
    res.status(400).json({ message: "Rol inválido." });
    return;
  }

  const { rows } = await pool.query(
    `UPDATE usuarios
     SET cliente_id = $1,
         email = $2,
         nombre = $3,
         rol = $4,
         activo = $5,
         updated_at = now()
     WHERE id = $6
     RETURNING id, cliente_id, email, nombre, rol, activo`,
    [clienteId, email, nombre, rol, activo, req.params.id]
  );

  if (!rows.length) {
    res.status(404).json({ message: "Usuario no encontrado." });
    return;
  }

  const client = await pool.query("SELECT nombre FROM clientes WHERE id = $1", [clienteId]);
  rows[0].cliente_nombre = client.rows[0]?.nombre || "";

  res.json(mapUsuario(rows[0]));
}));

app.post("/api/admin/usuarios/:id/reset-password", asyncHandler(async (req, res) => {
  const password = String(req.body.password || "");

  if (!password || password.length < 8) {
    res.status(400).json({ message: "La nueva contraseña debe tener al menos 8 caracteres." });
    return;
  }

  const result = await pool.query(
    `UPDATE usuarios
     SET password_hash = $1,
         updated_at = now()
     WHERE id = $2`,
    [hashPassword(password), req.params.id]
  );

  if (!result.rowCount) {
    res.status(404).json({ message: "Usuario no encontrado." });
    return;
  }

  res.status(204).send();
}));

app.use("/api/botellas", requireAuth);
app.use("/api/mediciones", requireAuth);

app.get("/api/botellas", asyncHandler(async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, nombre, pesovacio, densidad FROM botellas WHERE cliente_id = $1 AND activo = true ORDER BY nombre ASC",
    [_req.user.clienteId]
  );
  res.json(rows.map(mapBotella));
}));

app.get("/api/botellas/:id", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, nombre, pesovacio, densidad FROM botellas WHERE id = $1 AND cliente_id = $2 AND activo = true",
    [req.params.id, req.user.clienteId]
  );

  if (!rows.length) {
    res.status(404).json({ message: "Botella no encontrada." });
    return;
  }

  res.json(mapBotella(rows[0]));
}));

app.post("/api/botellas", asyncHandler(async (req, res) => {
  const validation = validateBotella(req.body);
  if (validation.error) {
    res.status(400).json({ message: validation.error });
    return;
  }

  const { nombre, pesoVacio, densidad } = validation.data;
  const { rows } = await pool.query(
    `INSERT INTO botellas (cliente_id, nombre, pesovacio, densidad)
     VALUES ($1, $2, $3, $4)
     RETURNING id, nombre, pesovacio, densidad`,
    [req.user.clienteId, nombre, pesoVacio, densidad]
  );

  res.status(201).json(mapBotella(rows[0]));
}));

async function actualizarBotella(req, res) {
  const validation = validateBotella(req.body);
  if (validation.error) {
    res.status(400).json({ message: validation.error });
    return;
  }

  const { nombre, pesoVacio, densidad } = validation.data;
  const { rows } = await pool.query(
    `UPDATE botellas
     SET nombre = $1,
         pesovacio = $2,
         densidad = $3,
         updated_at = now()
     WHERE id = $4
       AND cliente_id = $5
     RETURNING id, nombre, pesovacio, densidad`,
    [nombre, pesoVacio, densidad, req.params.id, req.user.clienteId]
  );

  if (!rows.length) {
    res.status(404).json({ message: "Botella no encontrada." });
    return;
  }

  res.json(mapBotella(rows[0]));
}

async function eliminarBotellaPorId(req, res) {
  const result = await pool.query("DELETE FROM botellas WHERE id = $1 AND cliente_id = $2", [
    req.params.id,
    req.user.clienteId
  ]);

  if (!result.rowCount) {
    res.status(404).json({ message: "Botella no encontrada." });
    return;
  }

  res.status(204).send();
}

app.put("/api/botellas/:id", asyncHandler(actualizarBotella));
app.post("/api/botellas/:id/actualizar", asyncHandler(actualizarBotella));
app.delete("/api/botellas/:id", asyncHandler(eliminarBotellaPorId));
app.post("/api/botellas/:id/eliminar", asyncHandler(eliminarBotellaPorId));

app.get("/api/mediciones", asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { rows } = await pool.query(
    `SELECT m.id,
            m.botella_id,
            b.nombre AS botella_nombre,
            u.nombre AS usuario_nombre,
            m.peso_actual,
            m.tamano_trago,
            m.peso_licor,
            m.tragos_decimales,
            m.tragos_fraccion,
            m.created_at
     FROM mediciones m
     JOIN botellas b ON b.id = m.botella_id
     JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.cliente_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [req.user.clienteId, limit]
  );

  res.json(rows.map(mapMedicion));
}));

app.post("/api/mediciones", asyncHandler(async (req, res) => {
  const botellaId = Number(req.body.botellaId);
  const pesoActual = Number(req.body.pesoActual);
  const tamanoTrago = Number(req.body.tamanoTrago);

  if (!Number.isInteger(botellaId) || botellaId <= 0) {
    res.status(400).json({ message: "Selecciona una botella valida." });
    return;
  }

  if (!Number.isFinite(pesoActual) || pesoActual <= 0) {
    res.status(400).json({ message: "Ingresa un peso actual valido." });
    return;
  }

  if (!Number.isFinite(tamanoTrago) || tamanoTrago <= 0) {
    res.status(400).json({ message: "Ingresa un tamano de trago valido." });
    return;
  }

  const botella = await pool.query(
    `SELECT id, nombre, pesovacio, densidad
     FROM botellas
     WHERE id = $1
       AND cliente_id = $2
       AND activo = true`,
    [botellaId, req.user.clienteId]
  );

  if (!botella.rows.length) {
    res.status(404).json({ message: "Botella no encontrada." });
    return;
  }

  const pesoVacio = Number(botella.rows[0].pesovacio);
  const densidad = Number(botella.rows[0].densidad);

  if (pesoActual < pesoVacio) {
    res.status(400).json({ message: "El peso actual no puede ser menor que el peso vacio." });
    return;
  }

  const pesoLicor = pesoActual - pesoVacio;
  const tragosDecimales = pesoLicor / (densidad * tamanoTrago);
  const tragosFraccion = convertirFraccion(tragosDecimales);

  const { rows } = await pool.query(
    `INSERT INTO mediciones (
       cliente_id,
       botella_id,
       usuario_id,
       peso_actual,
       tamano_trago,
       peso_licor,
       tragos_decimales,
       tragos_fraccion
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id,
               botella_id,
               $9::text AS botella_nombre,
               $10::text AS usuario_nombre,
               peso_actual,
               tamano_trago,
               peso_licor,
               tragos_decimales,
               tragos_fraccion,
               created_at`,
    [
      req.user.clienteId,
      botellaId,
      req.user.sub,
      pesoActual,
      tamanoTrago,
      pesoLicor,
      tragosDecimales,
      tragosFraccion,
      botella.rows[0].nombre,
      req.user.nombre
    ]
  );

  res.status(201).json(mapMedicion(rows[0]));
}));

app.get("/api/mediciones.csv", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.created_at,
            b.nombre AS botella_nombre,
            u.nombre AS usuario_nombre,
            m.peso_actual,
            m.tamano_trago,
            m.peso_licor,
            m.tragos_decimales,
            m.tragos_fraccion
     FROM mediciones m
     JOIN botellas b ON b.id = m.botella_id
     JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.cliente_id = $1
     ORDER BY m.created_at DESC`,
    [req.user.clienteId]
  );

  const header = [
    "fecha",
    "botella",
    "usuario",
    "peso_actual",
    "tamano_trago",
    "peso_licor",
    "tragos_decimales",
    "tragos_fraccion"
  ];
  const lines = rows.map((row) =>
    [
      row.created_at.toISOString(),
      row.botella_nombre,
      row.usuario_nombre,
      row.peso_actual,
      row.tamano_trago,
      row.peso_licor,
      row.tragos_decimales,
      row.tragos_fraccion
    ]
      .map(escapeCsv)
      .join(",")
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=mediciones-barraexacta.csv");
  res.send([header.join(","), ...lines].join("\n"));
}));

app.use("/api", (req, res) => {
  res.status(404).json({ message: "Recurso no encontrado." });
});

app.use((error, _req, res, _next) => {
  const duplicateName = error.code === "23505";
  const checkViolation = error.code === "23514";
  const foreignKeyViolation = error.code === "23503";

  if (duplicateName) {
    const constraint = String(error.constraint || "");

    if (constraint.includes("usuarios_email")) {
      res.status(409).json({ message: "Ya existe un usuario con ese correo." });
      return;
    }

    if (constraint.includes("clientes_slug")) {
      res.status(409).json({ message: "Ya existe un cliente con ese slug." });
      return;
    }

    res.status(409).json({ message: "Ya existe un registro con esos datos." });
    return;
  }

  if (checkViolation) {
    res.status(400).json({ message: "Los datos ingresados no son válidos." });
    return;
  }

  if (foreignKeyViolation) {
    res.status(400).json({ message: "El registro relacionado no existe." });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Ocurrió un error inesperado." });
});

if (require.main === module) {
  ensureSchemaOnce()
    .then(() => {
      app.listen(port, () => {
        console.log(`Servidor iniciado en http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error("No se pudo inicializar la base de datos.", error);
      process.exit(1);
    });
}

module.exports = app;
