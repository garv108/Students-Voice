import dotenv from "dotenv";
dotenv.config();
import helmet from "helmet";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { createServer } from "http";

const app = express();

// CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "https://students-voice-ll2onm3wl-garvs-projects-1900e5d8.vercel.app",
  "https://students-voice-bay.vercel.app",
];

const uniqueOrigins = [...new Set(allowedOrigins.filter(Boolean))];
console.log("🌐 Allowed CORS origins:", uniqueOrigins);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
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
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(helmet.xssFilter());
app.use(helmet.noSniff());
app.use(helmet.ieNoOpen());
app.use(helmet.frameguard({ action: "deny" }));
app.use(helmet.hidePoweredBy());

console.log("🔒 Helmet.js security headers enabled");

// Simple test endpoints (no database)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    server: "Student Complaint System - Security Test",
    security: "Helmet.js enabled"
  });
});

app.get("/api/test-headers", (req, res) => {
  // Return headers for inspection
  res.json({
    message: "Check response headers in browser dev tools",
    headers: res.getHeaders()
  });
});

const httpServer = createServer(app);
const PORT = 3002; // Different port to avoid conflict

httpServer.listen(PORT, () => {
  console.log(`✅ Security test server running on port ${PORT}`);
  console.log(`🌐 Test URL: http://localhost:${PORT}/api/health`);
});
