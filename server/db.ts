import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

console.log('📡 Connecting to database via HTTP pooling...');

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Pour Render
  } : false,
  // Railway n'a pas besoin de configuration spéciale
};

export const pool = new Pool(poolConfig);

// Test de connexion
async function connectWithRetry() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');
    client.release();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    // Ne pas planter, laisser Railway/Render gérer
  }
}

connectWithRetry().catch(err => {
  console.error('❌ Failed to connect to database');
  console.error('💡 Essayez la solution avec Docker/PgBouncer ci-dessous');
});

export const db = drizzle(pool, { schema });