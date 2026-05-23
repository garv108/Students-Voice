import dotenv from "dotenv";
dotenv.config();
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { registerAIChatRoutes } from "./routes/aiComplaints";

// ========== EARLY DEBUG ==========
console.log("🔴 EARLY DEBUG: Server starting");
console.log("File version: 2026-04-16-cors-final");
console.log("Current time:", new Date().toISOString());
// ========== END EARLY DEBUG ==========

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Validate required environment variables
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  console.error("🚨 FATAL ERROR: SESSION_SECRET environment variable is required for production");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);

// ========== CORS CONFIGURATION (FIXED) ==========
const allowedOrigins = [
  "https://students-voice-bay.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

// Also allow any Vercel preview deployment (pattern match)
const isVercelPreview = (origin: string): boolean => {
  return /^https:\/\/students-voice(-[a-z0-9]+)*(-garvs-projects-[a-z0-9]+)?\.vercel\.app$/.test(origin);
};

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin) || isVercelPreview(origin)) {
        console.log(`✅ CORS allowed: ${origin}`);
        return callback(null, true);
      }
      console.warn(`❌ CORS blocked: ${origin}`);
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Handle preflight requests explicitly (optional, but safe)
app.options("*", cors());

// Security middleware (helmet)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "https://*.vercel.app", "http://localhost:5173", "https://student-complaint-backend.onrender.com"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(helmet.xssFilter());
app.use(helmet.noSniff());
app.use(helmet.ieNoOpen());
app.use(helmet.frameguard({ action: "deny" }));
app.use(helmet.hidePoweredBy());

console.log("🔒 Helmet.js security headers enabled");

app.use(compression());
console.log("⚡ Compression enabled");

// JSON parsing
app.use(
  express.json({
    verify: (req: any, _res: Response, buf: Buffer) => {
      try {
        if (buf && buf.length > 0) {
          JSON.parse(buf.toString());
        }
      } catch (e: any) {
        console.error("❌ Invalid JSON received:", {
          url: req.url,
          method: req.method,
          error: e.message,
        });
        req.rawBody = buf?.toString() || "";
      }
    },
  })
);

app.use(express.urlencoded({ extended: true }));

// JSON parse error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
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
app.use((req: Request, res: Response, next: NextFunction) => {
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
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 100,
  message: { error: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}-${req.headers["user-agent"]}`,
});

const adminLimiter = rateLimit({
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
const PostgresSessionStore = pgSession(session);

const sessionConfig: session.SessionOptions = {
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
} else {
  console.warn("⚠️ No valid DATABASE_URL, using MemoryStore");
  if (process.env.NODE_ENV === "production") {
    console.error("🚨 PRODUCTION WARNING: Using MemoryStore! Add DATABASE_URL to Render environment.");
  }
}

app.use(session(sessionConfig));
console.log(`🔐 Session store: ${sessionConfig.store ? "PostgreSQL" : "MemoryStore"}`);
console.log("=== END DEBUG ===");

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "healthy", server: "Student Complaint System" });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await db.execute("SELECT 1");
    res.json({ status: "healthy", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(500).json({ status: "unhealthy", database: "disconnected" });
  }
});

app.get("/api/test", (_req, res) => {
  res.json({ message: "Backend test OK", timestamp: new Date().toISOString() });
});

// Setup endpoint locked in production
app.post("/api/setup/create-admin", (_req: Request, res: Response) => {
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
      const existingUsers = await db.select().from(users).where(eq(users.username, "admin"));
      if (existingUsers.length > 0) {
        return res.json({ success: false, message: "Admin user already exists" });
      }
      const hashedPassword = await hashPassword("admin123");
      await db.insert(users).values({
        username: "admin",
        email: "admin@example.com",
        password: hashedPassword,
        role: "admin",
      }).returning();
      res.json({ success: true, message: "Admin user created", password: "admin123" });
    } catch (error) {
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/leaderboard", (_req, res) => res.json([]));
  app.get("/api/complaints", (_req, res) => res.json([]));

  app.post("/api/auth/login", (req, res) => {
    (req as any).session.userId = "dev-user-123";
    res.json({ user: { id: "dev-user-123", email: "dev@example.com", username: "devuser", role: "student" } });
  });

  app.post("/api/auth/signup", (req, res) => {
    (req as any).session.userId = "dev-user-123";
    res.json({ user: { id: "dev-user-123", email: req.body?.email || "dev@example.com", username: req.body?.username || "devuser", role: "student" } });
  });
}

const httpServer = createServer(app);

registerRoutes(httpServer, app);
registerAIChatRoutes(app);   // ✅ now before error handlers

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
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
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: "Route not found", path: req.url });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV}`);
  console.log(`🍪 Cookie secure: ${sessionConfig.cookie?.secure}`);
  console.log(`🍪 Cookie sameSite: ${sessionConfig.cookie?.sameSite}`);
});