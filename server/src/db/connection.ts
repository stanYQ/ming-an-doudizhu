import mysql, { Pool } from "mysql2/promise";

let pool: Pool | null = null;

/** Lazy singleton mysql2 pool. Tests mock this module entirely. */
export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host:             process.env.DB_HOST     ?? "localhost",
      port:             Number(process.env.DB_PORT ?? 3306),
      user:             process.env.DB_USER     ?? "root",
      password:         process.env.DB_PASSWORD ?? "",
      database:         process.env.DB_NAME     ?? "game_db",
      waitForConnections: true,
      connectionLimit:  10,
    });
  }
  return pool;
}

/** Reset pool reference (for testing). */
export function resetPool(): void {
  pool = null;
}
