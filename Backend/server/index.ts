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
// import { serveStatic } from "./static"; // Disabled for production
import { createServer } from "http";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const app = express();

// CORS Configuration - Fixed for production
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "https://students-voice-ll2onm3wl-garvs-projects-1900e5d8.vercel.app",
    "https://students-voice-bay.vercel.app",
  ];

// Remove duplicates from array
const uniqueOrigins = [...new Set(allowedOrigins.filter(Boolean))];
console.log("🌐 Allowed CORS origins:", uniqueOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) {
      console.log("🔓 No origin - allowing request");
      return callback(null, true);
    }
    
    if (uniqueOrigins.includes(origin)) {
      console.log(`✅ CORS allowed for: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked: ${origin}`);
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
// Security middleware - Helmet.js
app.use(helmet({
  // Basic security headers
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "http://localhost:5173", "https://students-voice-ll2onm3wl-garvs-projects-1900e5d8.vercel.app", "https://students-voice-bay.vercel.app"],
    
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for some third-party services
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
}));

// Additional security headers
app.use(helmet.xssFilter()); // XSS protection
app.use(helmet.noSniff()); // Prevent MIME type sniffing
app.use(helmet.ieNoOpen()); // IE security
app.use(helmet.frameguard({ action: "deny" })); // Prevent clickjacking
app.use(helmet.hidePoweredBy()); // Hide Express signature

console.log("🔒 Helmet.js security headers enabled");

// Compression middleware
app.use(compression());
console.log("⚡ Compression enabled");

// Additional security headers middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Prevent caching of sensitive data (API responses)
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  // Additional XSS protection (redundant with Helmet but extra safety)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
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
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login/signup attempts per windowMs
  message: { error: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

const adminLimiter = rateLimit({
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
  const PostgresSessionStore = pgSession(session);

  const sessionConfig: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "studentvoice-secret-key-prod-123456",
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: 'user_sessions',
      pruneSessionInterval: 60 * 60, // Clean up expired sessions every hour
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    name: 'studentvoice.sid',
    proxy: process.env.NODE_ENV === "production",
  };

// Debug: Check why MemoryStore is being used
console.log("=== SESSION CONFIG DEBUG ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("DATABASE_URL exists:", !!process.env.DATABASE_URL);
console.log("DATABASE_URL sample:", process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + "..." : "none");
console.log("SESSION_SECRET exists:", !!process.env.SESSION_SECRET);
console.log("SESSION_SECRET length:", process.env.SESSION_SECRET?.length || 0);
console.log("Session store configured:", sessionConfig.store ? "PostgreSQL" : "MemoryStore");
console.log("=== END DEBUG ===");

  // For development, fall back to MemoryStore if no DATABASE_URL
  if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ No DATABASE_URL found, using MemoryStore for sessions (not for production!)');
    delete sessionConfig.store;
  }

  app.use(session(sessionConfig));
  console.log(`🔐 Session store: ${sessionConfig.store ? 'PostgreSQL' : 'MemoryStore (dev only)'}`);

// SECURED: Setup endpoint disabled for production
app.post("/api/setup/create-admin", (req: Request, res: Response) => {
  res.status(403).json({ 
    success: false, 
    message: "Setup endpoint disabled for security in production.",
    note: "If you need to reset admin, run direct SQL or use signup endpoint."
  });
});
// Test endpoints
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend test OK", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", server: "Student Complaint System" });
});

// DEVELOPMENT MOCK ENDPOINTS - Add these BEFORE real routes
if (process.env.NODE_ENV === "development") {
  console.log("⚠️ Development mode: Mock endpoints enabled");
  
  // Development-only setup endpoint
  app.post("/api/setup/create-admin", async (req, res) => {
    try {
      console.log("🔧 Development setup endpoint called");
      
      const existingUsers = await db.select().from(users).where(eq(users.username, "admin"));
      
      if (existingUsers.length > 0) {
        return res.json({ 
          success: false, 
          message: "Admin user already exists",
          username: "admin"
        });
      }
      
      const hashedPassword = await hashPassword("admin123");
      const [admin] = await db.insert(users).values({
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
    } catch (error) {
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
  
  // Mock auth/me endpoint
  app.get("/api/auth/me", (req, res) => {
    console.log("👤 Mock auth/me endpoint called");
    res.json({
      id: "dev-user-123",
      email: "dev@example.com",
      name: "Development User",
      role: "student",
      createdAt: new Date().toISOString()
    });
  });
  
  // Mock login endpoint
  app.post("/api/auth/login", (req, res) => {
    console.log("🔐 Mock login endpoint called");
    // Set session
    (req as any).session.userId = "dev-user-123";
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
    (req as any).session.userId = "dev-user-123";
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

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const httpServer = createServer(app);

// Register API routes - pass both httpServer and app
registerRoutes(httpServer, app);

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  // serveStatic(app); // Disabled for production
}

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV}`);
  console.log(`🔒 Setup endpoint: ${process.env.NODE_ENV === 'production' ? 'DISABLED for security' : 'ENABLED for development'}`);
});