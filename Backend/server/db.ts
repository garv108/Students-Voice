import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

let pool: pg.Pool;
let db: any;

// Development mode: create mock database if no DATABASE_URL or dummy URL
if (process.env.NODE_ENV === "development" && (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("dummy"))) {
  console.log("⚠️ Development mode: Using mock database");
  
  // Create a mock pool
  pool = {
    connect: async () => {
      console.log("Mock database connect called");
      return {
        release: () => {},
        query: async () => ({ rows: [] }),
      } as any;
    },
    query: async (text: string, params?: any[]) => {
      console.log(`Mock query: ${text.substring(0, 50)}...`);
      return { rows: [], rowCount: 0 };
    },
    end: async () => {
      console.log("Mock database connection ended");
    },
    on: (event: string, callback: Function) => {
      // Mock event handler
      return pool;
    },
  } as any;
  
  // Create mock drizzle db with proper return values
  db = {
    select: () => ({
      from: () => ({
        orderBy: () => Promise.resolve([]), // Return empty array
        where: () => Promise.resolve([]),   // Return empty array
        limit: () => Promise.resolve([]),   // Return empty array
        leftJoin: () => ({
          orderBy: () => Promise.resolve([]),
          where: () => Promise.resolve([])
        })
      })
    }),
    insert: () => ({
      values: () => Promise.resolve({ rows: [] })
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve({ rows: [] })
      })
    }),
    delete: () => ({
      where: () => Promise.resolve({ rows: [] })
    })
  };
} else {
  // Production mode - require real database
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
  
  // Test connection
  pool.connect((err, client, release) => {
    if (err) {
      console.error("❌ Database connection error:", err.message);
    } else {
      console.log("✅ Database connected successfully");
      release();
    }
  });
}

export { pool, db };
