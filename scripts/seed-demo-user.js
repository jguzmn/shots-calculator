const { Pool } = require("pg");
const { hashPassword } = require("../lib/auth-utils");
require("dotenv").config();

const databaseUrl = process.env.DATABASE_URL;
const demoEmail = process.env.DEMO_USER_EMAIL || "demo@barraexacta.app";
const demoPassword = process.env.DEMO_USER_PASSWORD || "DemoBarraExacta2026!";
const demoName = process.env.DEMO_USER_NAME || "Usuario Demo";

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL. Crea un archivo .env basado en .env.example.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function ensureSchema() {
  await pool.query(`
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

    CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_lower_unique
      ON usuarios (lower(email));
  `);
}

async function main() {
  await ensureSchema();

  const passwordHash = hashPassword(demoPassword);

  const email = demoEmail.toLowerCase();
  const existing = await pool.query("SELECT id FROM usuarios WHERE lower(email) = lower($1)", [email]);

  if (existing.rows.length) {
    await pool.query(
      `UPDATE usuarios
       SET nombre = $1,
           rol = 'demo',
           password_hash = $2,
           activo = true,
           updated_at = now()
       WHERE id = $3`,
      [demoName, passwordHash, existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO usuarios (email, nombre, rol, password_hash, activo)
       VALUES ($1, $2, 'demo', $3, true)`,
      [email, demoName, passwordHash]
    );
  }

  console.log(`Usuario demo listo: ${demoEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
