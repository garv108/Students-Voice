"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const express_session_1 = __importDefault(require("express-session"));
const connect_pg_simple_1 = __importDefault(require("connect-pg-simple"));
const routes_1 = require("./routes");
const http_1 = require("http");
const db_1 = require("./db");
const schema_1 = require("../shared/schema");
const drizzle_orm_1 = require("drizzle-orm");
const crypto_1 = require("crypto");
const util_1 = require("util");
// ========== EARLY DEBUG ==========
console.log("🔴 EARLY DEBUG: Server starting");
console.log("File version: 2026-02-25-cors-fix");
console.log("Current time:", new Date().toISOString());
const scryptAsync = (0, util_1.promisify)(crypto_1.scrypt);
async function hashPassword(password) {
    const salt = (0, crypto_1.randomBytes)(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64));
    return `${buf.toString("hex")}.${salt}`;
}
// Validate required environment variables
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
    console.error("🚨 FATAL ERROR: SESSION_SECRET environment variable is required for production");
    process.exit(1);
}
const app = (0, express_1.default)();
app.set("trust proxy", 1);
// CORS: allow localhost + any students-voice Vercel deployment (preview URLs change every push)
function isAllowedOrigin(origin) {
    if (origin === "http://localhost:5173")
        return true;
    if (origin === "http://localhost:3000")
        return true;
    // Allow the stable production Vercel URL
    if (origin === "https://students-voice-bay.vercel.app")
        return true;
    // Allow ALL Vercel preview deployments for this project (pattern match)
    if (/^https:\/\/students-voice(-[a-z0-9]+)*(-garvs-projects-[a-z0-9]+)?\.vercel\.app$/.test(origin))
        return true;
    return false;
}
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (curl, Postman, server-to-server)
        if (!origin) {
            return callback(null, true);
        }
        if (isAllowedOrigin(origin)) {
            console.log(`✅ CORS allowed: ${origin}`);
            callback(null, true);
        }
        else {
            console.warn(`❌ CORS blocked: ${origin}`);
            callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
        }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", "https://*.vercel.app", "http://localhost:5173"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(helmet_1.default.xssFilter());
app.use(helmet_1.default.noSniff());
app.use(helmet_1.default.ieNoOpen());
app.use(helmet_1.default.frameguard({ action: "deny" }));
app.use(helmet_1.default.hidePoweredBy());
console.log("🔒 Helmet.js security headers enabled");
app.use((0, compression_1.default)());
console.log("⚡ Compression enabled");
// JSON parsing
app.use(express_1.default.json({
    verify: (req, _res, buf) => {
        try {
            if (buf && buf.length > 0) {
                JSON.parse(buf.toString());
            }
        }
        catch (e) {
            console.error("❌ Invalid JSON received:", {
                url: req.url,
                method: req.method,
                error: e.message,
            });
            req.rawBody = buf?.toString() || "";
        }
    },
}));
app.use(express_1.default.urlencoded({ extended: true }));
// JSON parse error handler
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({
            success: false,
            error: "Invalid JSON format",
            message: "Please check your request body for JSON syntax errors",
        });
    }
    next(err);
});
// API cache-control headers
app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
    }
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
    next();
});
console.log("🔒 Additional security headers enabled");
// Rate limiting
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 10 : 100,
    message: { error: "Too many authentication attempts, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${req.ip}-${req.headers["user-agent"]}`,
});
const adminLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: "Too many admin requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/change-password", authLimiter);
app.use("/api/admin", adminLimiter);
app.use("/api", generalLimiter);
console.log("🔒 Rate limiting enabled");
// Session configuration
const PostgresSessionStore = (0, connect_pg_simple_1.default)(express_session_1.default);
const sessionConfig = {
    secret: process.env.SESSION_SECRET || "studentvoice-secret-key-prod-123456",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
    },
    name: "studentvoice.sid",
    proxy: true,
};
console.log("=== SESSION CONFIG DEBUG ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("Cookie secure:", sessionConfig.cookie?.secure);
console.log("Cookie sameSite:", sessionConfig.cookie?.sameSite);
console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
console.log("SESSION_SECRET exists:", !!process.env.SESSION_SECRET);
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgresql://")) {
    console.log("✅ Setting up PostgreSQL session store");
    sessionConfig.store = new PostgresSessionStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        tableName: "user_sessions",
        pruneSessionInterval: 60 * 60,
    });
}
else {
    console.warn("⚠️ No valid DATABASE_URL, using MemoryStore");
    if (process.env.NODE_ENV === "production") {
        console.error("🚨 PRODUCTION WARNING: Using MemoryStore! Add DATABASE_URL to Render environment.");
    }
}
app.use((0, express_session_1.default)(sessionConfig));
console.log(`🔐 Session store: ${sessionConfig.store ? "PostgreSQL" : "MemoryStore"}`);
console.log("=== END DEBUG ===");
// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "healthy", server: "Student Complaint System" });
});
app.get("/api/health/db", async (_req, res) => {
    try {
        await db_1.db.execute("SELECT 1");
        res.json({ status: "healthy", database: "connected" });
    }
    catch (error) {
        console.error("Database health check failed:", error);
        res.status(500).json({ status: "unhealthy", database: "disconnected" });
    }
});
app.get("/api/test", (_req, res) => {
    res.json({ message: "Backend test OK", timestamp: new Date().toISOString() });
});
// Setup endpoint locked in production
app.post("/api/setup/create-admin", (_req, res) => {
    res.status(403).json({
        success: false,
        message: "Setup endpoint disabled for security in production.",
    });
});
// Development mock endpoints
if (process.env.NODE_ENV === "development" && process.env.ENABLE_MOCK_ENDPOINTS === "true") {
    console.log("⚠️ Development mode: Mock endpoints enabled");
    app.post("/api/setup/create-admin", async (req, res) => {
        try {
            const existingUsers = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.username, "admin"));
            if (existingUsers.length > 0) {
                return res.json({ success: false, message: "Admin user already exists" });
            }
            const hashedPassword = await hashPassword("admin123");
            await db_1.db.insert(schema_1.users).values({
                username: "admin",
                email: "admin@example.com",
                password: hashedPassword,
                role: "admin",
            }).returning();
            res.json({ success: true, message: "Admin user created", password: "admin123" });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
    });
    app.get("/api/leaderboard", (_req, res) => res.json([]));
    app.get("/api/complaints", (_req, res) => res.json([]));
    app.post("/api/auth/login", (req, res) => {
        req.session.userId = "dev-user-123";
        res.json({ user: { id: "dev-user-123", email: "dev@example.com", username: "devuser", role: "student" } });
    });
    app.post("/api/auth/signup", (req, res) => {
        req.session.userId = "dev-user-123";
        res.json({ user: { id: "dev-user-123", email: req.body?.email || "dev@example.com", username: req.body?.username || "devuser", role: "student" } });
    });
}
const httpServer = (0, http_1.createServer)(app);
(0, routes_1.registerRoutes)(httpServer, app);
// Global error handler
app.use((err, req, res, _next) => {
    console.error("🚨 Unhandled Error:", {
        message: err.message,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
    });
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === "production" ? "Something went wrong!" : err.message,
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: "Route not found", path: req.url });
});
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV}`);
    console.log(`🍪 Cookie secure: ${sessionConfig.cookie?.secure}`);
    console.log(`🍪 Cookie sameSite: ${sessionConfig.cookie?.sameSite}`);
});
