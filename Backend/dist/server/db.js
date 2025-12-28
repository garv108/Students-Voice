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
                orderBy: () => Promise.resolve([]), // Return empty array
                where: () => Promise.resolve([]), // Return empty array
                limit: () => Promise.resolve([]), // Return empty array
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
    exports.pool = pool = new Pool({ connectionString: process.env.DATABASE_URL });
    exports.db = db = (0, node_postgres_1.drizzle)(pool, { schema });
    // Test connection
    pool.connect((err, client, release) => {
        if (err) {
            console.error("❌ Database connection error:", err.message);
        }
        else {
            console.log("✅ Database connected successfully");
            release();
        }
    });
}
