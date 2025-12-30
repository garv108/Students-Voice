"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.pool = void 0;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = __importDefault(require("pg"));
const schema = __importStar(require("../shared/schema"));
const { Pool } = pg_1.default;
let pool;
let db;
async function createTablesIfNotExist(client) {
    console.log("🔧 Checking/Creating database tables...");
    try {
        // Create enums first (if they don't exist)
        await client.query(`
      DO $$ BEGIN
        CREATE TYPE role AS ENUM ('student', 'moderator', 'admin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE status AS ENUM ('pending', 'in_progress', 'solved');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE urgency AS ENUM ('normal', 'urgent', 'critical', 'top_priority', 'emergency');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE severity AS ENUM ('good', 'average', 'poor', 'bad', 'worst', 'critical');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        // Create users table
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role role NOT NULL DEFAULT 'student',
        banned_until TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        // Create cluster_groups table
        await client.query(`
      CREATE TABLE IF NOT EXISTS cluster_groups (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        representative_problem_id VARCHAR,
        representative_summary TEXT,
        keywords TEXT[],
        problem_count INTEGER NOT NULL DEFAULT 0,
        severity severity DEFAULT 'average',
        urgency urgency NOT NULL DEFAULT 'normal',
        last_updated TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        // Create complaints table
        await client.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        original_text TEXT NOT NULL,
        summary TEXT,
        severity severity DEFAULT 'average',
        keywords TEXT[],
        status status NOT NULL DEFAULT 'pending',
        solved BOOLEAN NOT NULL DEFAULT FALSE,
        solved_by VARCHAR REFERENCES users(id),
        solved_at TIMESTAMP,
        urgency urgency NOT NULL DEFAULT 'normal',
        similar_complaints_count INTEGER NOT NULL DEFAULT 0,
        cluster_id VARCHAR REFERENCES cluster_groups(id),
        likes_count INTEGER NOT NULL DEFAULT 0,
        dislikes_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        // Create reactions table
        await client.query(`
      CREATE TABLE IF NOT EXISTS reactions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        complaint_id VARCHAR NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        // Create likes table
        await client.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        complaint_id VARCHAR NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_like BOOLEAN NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        // Create abuse_logs table
        await client.query(`
      CREATE TABLE IF NOT EXISTS abuse_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        flagged_text TEXT NOT NULL,
        detected_words TEXT[],
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
        // Create indexes
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id);
      CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
      CREATE INDEX IF NOT EXISTS idx_complaints_cluster_id ON complaints(cluster_id);
      CREATE INDEX IF NOT EXISTS idx_reactions_complaint_id ON reactions(complaint_id);
      CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_likes_complaint_id ON likes(complaint_id);
      CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
      CREATE INDEX IF NOT EXISTS idx_abuse_logs_user_id ON abuse_logs(user_id);
    `);
        console.log("✅ Database tables created/verified successfully");
        return true;
    }
    catch (error) {
        console.error("❌ Error creating tables:", error);
        throw error;
    }
}
// Development mode: create mock database if no DATABASE_URL or dummy URL
if (process.env.NODE_ENV === "development" && (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("dummy"))) {
    console.log("⚠️ Development mode: Using mock database");
    // Create a mock pool
    exports.pool = pool = {
        connect: async () => {
            console.log("Mock database connect called");
            return {
                release: () => { },
                query: async () => ({ rows: [] }),
            };
        },
        query: async (text, params) => {
            console.log(`Mock query: ${text.substring(0, 50)}...`);
            return { rows: [], rowCount: 0 };
        },
        end: async () => {
            console.log("Mock database connection ended");
        },
        on: (event, callback) => {
            // Mock event handler
            return pool;
        },
    };
    // Create mock drizzle db with proper return values
    exports.db = db = {
        select: () => ({
            from: () => ({
                orderBy: () => Promise.resolve([]),
                where: () => Promise.resolve([]),
                limit: () => Promise.resolve([]),
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
}
else {
    // Production mode - require real database
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
    }
    exports.pool = pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });
    exports.db = db = (0, node_postgres_1.drizzle)(pool, { schema });
    // Test connection and create tables
    pool.connect(async (err, client, release) => {
        if (err) {
            console.error("❌ Database connection error:", err.message);
        }
        else {
            try {
                console.log("✅ Database connected successfully");
                await createTablesIfNotExist(client);
                // Check if any users exist
                try {
                    const result = await client.query("SELECT COUNT(*) as count FROM users");
                    const userCount = parseInt(result.rows[0].count);
                    console.log(`👤 Found ${userCount} users in database`);
                    if (userCount === 0) {
                        console.log("ℹ️ No users found. Please create first user via signup endpoint or setup");
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.log("ℹ️ Could not check user count, tables might be fresh:", errorMessage);
                }
            }
            catch (error) {
                console.error("❌ Database initialization error:", error);
            }
            finally {
                release();
            }
        }
    });
}
