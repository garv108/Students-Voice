import dotenv from "dotenv";
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
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
  "https://students-voice.vercel.app" // Add your main domain if different
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

// Session middleware (for development - will be overridden by routes.ts in production)
import session from "express-session";
app.use(session({
  secret: process.env.SESSION_SECRET || "studentvoice-secret-key-prod-123456",
  resave: false,
  saveUninitialized: false, // Security: don't save empty sessions
  cookie: {
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Required for cross-site cookies
    httpOnly: true, // Prevents XSS attacks
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    domain: process.env.NODE_ENV === "production" ? ".onrender.com" : undefined
  },
  name: 'studentvoice.sid', // Unique session name
  proxy: process.env.NODE_ENV === "production", // Trust proxy in production
}));

// Add middleware to log sessions for debugging
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.path} - Session ID: ${req.sessionID?.substring(0, 10)}...`);
  next();
});

// SECURED: Setup endpoint disabled for production
app.post("/api/setup/create-admin", (req, res) => {
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