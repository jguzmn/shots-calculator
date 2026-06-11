const { Pool } = require("pg");
const { hashPassword } = require("../lib/auth-utils");
require("dotenv").config();

const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_USER_EMAIL || "admin@barraexacta.app";
const adminPassword = process.env.ADMIN_USER_PASSWORD || "AdminBarraExacta2026!";
const adminName = process.env.ADMIN_USER_NAME || "Administrador BarraExacta";
const adminClientName = process.env.ADMIN_CLIENT_NAME || "BarraExacta";
const adminClientSlug = process.env.ADMIN_CLIENT_SLUG || "barraexacta";

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL. Crea un archivo .env basado en .env.example.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

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
  `);
}

async function main() {
  await ensureSchema();

  const client = await pool.query(
    `INSERT INTO clientes (nombre, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug)
     DO UPDATE SET nombre = EXCLUDED.nombre, updated_at = now()
     RETURNING id`,
    [adminClientName, adminClientSlug]
  );
  const clientId = client.rows[0].id;
  const email = adminEmail.toLowerCase();
  const passwordHash = hashPassword(adminPassword);
  const existing = await pool.query("SELECT id FROM usuarios WHERE lower(email) = lower($1)", [email]);

  if (existing.rows.length) {
    await pool.query(
      `UPDATE usuarios
       SET cliente_id = $1,
           nombre = $2,
           rol = 'super_admin',
           password_hash = $3,
           activo = true,
           updated_at = now()
       WHERE id = $4`,
      [clientId, adminName, passwordHash, existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO usuarios (cliente_id, email, nombre, rol, password_hash, activo)
       VALUES ($1, $2, $3, 'super_admin', $4, true)`,
      [clientId, email, adminName, passwordHash]
    );
  }

  console.log(`Usuario super admin listo: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
