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
console.log("File version: 2025-01-07-cookie-fix");
console.log("Current time:", new Date().toISOString());
const scryptAsync = (0, util_1.promisify)(crypto_1.scrypt);
async function hashPassword(password) {
    const salt = (0, crypto_1.randomBytes)(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64));
    return `${buf.toString("hex")}.${salt}`;
}
// Validate required environment variables
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === 'production') {
    console.error("🚨 FATAL ERROR: SESSION_SECRET environment variable is required for production");
    process.exit(1);
}
const app = (0, express_1.default)();
app.set('trust proxy', 1);
// CORS Configuration - Fixed for production
const allowedOrigins = [
    // Split FRONTEND_URL if it contains multiple origins
    ...(process.env.FRONTEND_URL ?
        process.env.FRONTEND_URL.split(',').map(s => s.trim()) :
        ["http://localhost:5173"]),
    "https://students-voice-ll2onm3wl-garvs-projects-1900e5d8.vercel.app",
    "https://students-voice-bay.vercel.app",
    "https://students-voice-o20ai0bql-garvs-projects-1900e5d8.vercel.app",
];
// Remove duplicates AND trailing slashes from array
const normalizeOrigin = (origin) => origin.replace(/\/$/, ''); // Remove trailing slash
const uniqueOrigins = [...new Set(allowedOrigins.filter(Boolean).map(normalizeOrigin))];
console.log("🌐 Allowed CORS origins:", uniqueOrigins);
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) {
            if (process.env.NODE_ENV === 'development') {
                console.log("🔓 No origin - allowing request");
            }
            return callback(null, true);
        }
        if (uniqueOrigins.includes(origin)) {
            if (process.env.NODE_ENV === 'development') {
                console.log(`✅ CORS allowed for: ${origin}`);
            }
            callback(null, true);
        }
        else {
            console.warn(`❌ CORS blocked: ${origin}`);
            callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
        }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
// Security middleware - Helmet.js
app.use((0, helmet_1.default)({
    // Basic security headers
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            connectSrc: ["'self'", ...uniqueOrigins],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false, // Required for some third-party services
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
}));
// Additional security headers
app.use(helmet_1.default.xssFilter()); // XSS protection
app.use(helmet_1.default.noSniff()); // Prevent MIME type sniffing
app.use(helmet_1.default.ieNoOpen()); // IE security
app.use(helmet_1.default.frameguard({ action: "deny" })); // Prevent clickjacking
app.use(helmet_1.default.hidePoweredBy()); // Hide Express signature
console.log("🔒 Helmet.js security headers enabled");
// Compression middleware
app.use((0, compression_1.default)());
console.log("⚡ Compression enabled");
// JSON parsing with validation for invalid JSON
app.use(express_1.default.json({
    verify: (req, res, buf) => {
        try {
            if (buf && buf.length > 0) {
                JSON.parse(buf.toString());
            }
        }
        catch (e) {
            console.error("❌ Invalid JSON received:", {
                url: req.url,
                method: req.method,
                contentLength: buf?.length || 0,
                contentType: req.headers['content-type'],
                first100Chars: buf?.toString().substring(0, 100),
                error: e.message
            });
            // Store the raw buffer for debugging
            req.rawBody = buf?.toString() || '';
        }
    }
}));
app.use(express_1.default.urlencoded({ extended: true }));
// JSON parsing error handler
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && 'body' in err) {
        console.error('JSON Syntax Error:', {
            url: req.url,
            method: req.method,
            error: err.message,
            rawBody: req.rawBody?.substring(0, 200)
        });
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON format',
            message: 'Please check your request body for JSON syntax errors',
            help: 'Ensure your request has proper JSON syntax with double quotes for keys and values'
        });
    }
    next(err);
});
// Additional security headers middleware
app.use((req, res, next) => {
    // Prevent caching of sensitive data (API responses)
    if (req.path.startsWith('/api')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    }
    // Referrer policy for privacy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions policy - restrict browser features
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    // Expect-CT header (phasing out but still useful)
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
    next();
});
console.log("🔒 Additional security headers enabled");
// Rate limiting configuration
const generalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: "Too many requests, please try again later." },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 10 : 100, // More lenient in dev
    message: { error: "Too many authentication attempts, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    keyGenerator: (req) => {
        // Use IP + user-agent for better rate limiting
        return `${req.ip}-${req.headers['user-agent']}`;
    }
});
const adminLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // More generous for admin operations
    message: { error: "Too many admin requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});
// Apply rate limiting
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/change-password", authLimiter);
app.use("/api/admin", adminLimiter);
app.use("/api", generalLimiter); // Apply to all other API routes
console.log("🔒 Rate limiting enabled");
// PostgreSQL session store configuration
const PostgresSessionStore = (0, connect_pg_simple_1.default)(express_session_1.default);
const sessionConfig = {
    secret: process.env.SESSION_SECRET || "studentvoice-secret-key-prod-123456",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
    },
    name: 'studentvoice.sid',
    proxy: true,
};
// Debug before setting store
console.log("=== SESSION CONFIG DEBUG ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("Cookie secure:", sessionConfig.cookie?.secure);
console.log("Cookie sameSite:", sessionConfig.cookie?.sameSite);
console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
    console.log("DATABASE_URL sample:", process.env.DATABASE_URL.substring(0, 30) + "...");
}
console.log("SESSION_SECRET exists:", !!process.env.SESSION_SECRET);
if (process.env.SESSION_SECRET) {
    console.log("SESSION_SECRET length:", process.env.SESSION_SECRET.length);
}
// Set PostgreSQL store if DATABASE_URL exists and looks valid
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql://')) {
    console.log("✅ Setting up PostgreSQL session store");
    sessionConfig.store = new PostgresSessionStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        tableName: 'user_sessions',
        pruneSessionInterval: 60 * 60,
    });
}
else {
    console.warn("⚠️ No valid DATABASE_URL, using MemoryStore");
    if (process.env.NODE_ENV === 'production') {
        console.error("🚨 PRODUCTION WARNING: Using MemoryStore! Add DATABASE_URL to Render environment.");
    }
}
app.use((0, express_session_1.default)(sessionConfig));
console.log(`🔐 Session store: ${sessionConfig.store ? 'PostgreSQL' : 'MemoryStore'}`);
console.log("=== END DEBUG ===");
// Health check endpoints
app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", server: "Student Complaint System" });
});
app.get("/api/health/db", async (req, res) => {
    try {
        await db_1.db.execute('SELECT 1');
        res.json({ status: "healthy", database: "connected" });
    }
    catch (error) {
        console.error("Database health check failed:", error);
        res.status(500).json({ status: "unhealthy", database: "disconnected" });
    }
});
// Test endpoint
app.get("/api/test", (req, res) => {
    res.json({ message: "Backend test OK", timestamp: new Date().toISOString() });
});
// SECURED: Setup endpoint disabled for production
app.post("/api/setup/create-admin", (req, res) => {
    res.status(403).json({
        success: false,
        message: "Setup endpoint disabled for security in production.",
        note: "If you need to reset admin, run direct SQL or use signup endpoint."
    });
});
// DEVELOPMENT MOCK ENDPOINTS - Add these BEFORE real routes
if (process.env.NODE_ENV === "development" && process.env.ENABLE_MOCK_ENDPOINTS === "true") {
    console.log("⚠️ Development mode: Mock endpoints enabled");
    // Development-only setup endpoint
    app.post("/api/setup/create-admin", async (req, res) => {
        try {
            console.log("🔧 Development setup endpoint called");
            const existingUsers = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.username, "admin"));
            if (existingUsers.length > 0) {
                return res.json({
                    success: false,
                    message: "Admin user already exists",
                    username: "admin"
                });
            }
            const hashedPassword = await hashPassword("admin123");
            const [admin] = await db_1.db.insert(schema_1.users).values({
                username: "admin",
                email: "admin@example.com",
                password: hashedPassword,
                role: "admin"
            }).returning();
            console.log("✅ Admin user created (development)");
            res.json({
                success: true,
                message: "Admin user created successfully",
                user: {
                    username: "admin",
                    password: "admin123",
                    role: "admin",
                    note: "Change password immediately"
                }
            });
        }
        catch (error) {
            console.error("❌ Setup error:", error);
            res.status(500).json({
                success: false,
                error: "Failed to create admin user",
                details: error instanceof Error ? error.message : String(error)
            });
        }
    });
    // Mock leaderboard endpoint
    app.get("/api/leaderboard", (req, res) => {
        console.log("📊 Mock leaderboard endpoint called");
        res.json([
            { id: "1", name: "Test User 1", score: 100, complaints: 5 },
            { id: "2", name: "Test User 2", score: 85, complaints: 4 },
            { id: "3", name: "Test User 3", score: 70, complaints: 3 }
        ]);
    });
    // Mock login endpoint
    app.post("/api/auth/login", (req, res) => {
        console.log("🔐 Mock login endpoint called");
        // Set session
        req.session.userId = "dev-user-123";
        res.json({
            user: {
                id: "dev-user-123",
                email: "dev@example.com",
                name: "Development User",
                role: "student"
            },
            message: "Login successful (development mode)"
        });
    });
    // Mock signup endpoint
    app.post("/api/auth/signup", (req, res) => {
        console.log("📝 Mock signup endpoint called");
        // Set session
        req.session.userId = "dev-user-123";
        res.json({
            user: {
                id: "dev-user-123",
                email: req.body?.email || "dev@example.com",
                name: req.body?.name || "Development User",
                role: "student"
            },
            message: "Signup successful (development mode)"
        });
    });
    // Mock complaints endpoint
    app.get("/api/complaints", (req, res) => {
        console.log("📝 Mock complaints endpoint called");
        res.json([]);
    });
}
const httpServer = (0, http_1.createServer)(app);
// Register API routes - pass both httpServer and app
(0, routes_1.registerRoutes)(httpServer, app);
// Serve static files in production
if (process.env.NODE_ENV === "production") {
    // serveStatic(app); // Disabled for production
}
// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('🚨 Unhandled Error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? "Something went wrong!" : err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.url
    });
});
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV}`);
    console.log(`🍪 Cookie secure: ${sessionConfig.cookie?.secure}`);
    console.log(`🍪 Cookie sameSite: ${sessionConfig.cookie?.sameSite}`);
    console.log(`🔒 Setup endpoint: ${process.env.NODE_ENV === 'production' ? 'DISABLED for security' : 'ENABLED for development'}`);
    console.log(`🔍 JSON validation: ${process.env.NODE_ENV === 'production' ? 'ENABLED' : 'ENABLED with verbose logging'}`);
});
