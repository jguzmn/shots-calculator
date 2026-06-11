const path = require("node:path");
const express = require("express");
const { Pool } = require("pg");
const { signSession, verifyPassword, verifySession } = require("./lib/auth-utils");
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

  if (duplicateName) {
    res.status(409).json({ message: "Ya existe una botella con ese nombre." });
    return;
  }

  if (checkViolation) {
    res.status(400).json({ message: "Los datos de la botella no son válidos." });
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
