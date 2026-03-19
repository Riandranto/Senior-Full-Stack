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
  ssl: {
    rejectUnauthorized: false,
    require: true
  },
  // Configuration pour les réseaux restreints
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 5,
  family: 4,
  // Important: forcer l'utilisation du pooling HTTP
  port: 443, // Forcer le port HTTPS
  host: 'ep-curly-frost-ajlhj510-pooler.c-3.us-east-2.aws.neon.tech'
};

export const pool = new Pool(poolConfig);

// Test de connexion
async function connectWithRetry(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('✅ Database connection successful via HTTP pooling!');
      client.release();
      return true;
    } catch (err) {
      console.log(`❌ Attempt ${i + 1}/${retries}:`, err.message);
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

connectWithRetry().catch(err => {
  console.error('❌ Failed to connect to database');
  console.error('💡 Essayez la solution avec Docker/PgBouncer ci-dessous');
});

export const db = drizzle(pool, { schema });