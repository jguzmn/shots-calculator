const { Pool } = require("pg");
const { hashPassword } = require("../lib/auth-utils");
require("dotenv").config();

const databaseUrl = process.env.DATABASE_URL;
const demoEmail = process.env.DEMO_USER_EMAIL || "demo@barraexacta.app";
const demoPassword = process.env.DEMO_USER_PASSWORD || "DemoBarraExacta2026!";
const demoName = process.env.DEMO_USER_NAME || "Usuario Demo";
const demoClientName = process.env.DEMO_CLIENT_NAME || "Cliente Demo";
const demoClientSlug = process.env.DEMO_CLIENT_SLUG || "demo";

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

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_cliente_id_fkey'
      ) THEN
        ALTER TABLE usuarios
          ADD CONSTRAINT usuarios_cliente_id_fkey
          FOREIGN KEY (cliente_id) REFERENCES clientes(id);
      END IF;
    END $$;
  `);
}

async function main() {
  await ensureSchema();

  const passwordHash = hashPassword(demoPassword);
  const client = await pool.query(
    `INSERT INTO clientes (nombre, slug)
     VALUES ($1, $2)
     ON CONFLICT (slug)
     DO UPDATE SET nombre = EXCLUDED.nombre, updated_at = now()
     RETURNING id`,
    [demoClientName, demoClientSlug]
  );
  const clientId = client.rows[0].id;

  const email = demoEmail.toLowerCase();
  const existing = await pool.query("SELECT id FROM usuarios WHERE lower(email) = lower($1)", [email]);

  if (existing.rows.length) {
    await pool.query(
      `UPDATE usuarios
       SET nombre = $1,
           rol = 'demo',
           password_hash = $2,
           activo = true,
           cliente_id = $3,
           updated_at = now()
       WHERE id = $4`,
      [demoName, passwordHash, clientId, existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO usuarios (cliente_id, email, nombre, rol, password_hash, activo)
       VALUES ($1, $2, $3, 'demo', $4, true)`,
      [clientId, email, demoName, passwordHash]
    );
  }

  console.log(`Usuario demo listo: ${demoEmail} (${demoClientName})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
