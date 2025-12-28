"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = require("./routes");
const static_1 = require("./static");
const http_1 = require("http");
const app = (0, express_1.default)();
// CORS Configuration
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
}));
// Session middleware (for development)
const express_session_1 = __importDefault(require("express-session"));
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || "dev-secret-key-123456",
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));
// Test endpoints
app.get("/api/test", (req, res) => {
    res.json({ message: "Backend test OK", timestamp: new Date().toISOString() });
});
app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", server: "Student Complaint System" });
}); // DEVELOPMENT MOCK ENDPOINTS - Add these BEFORE real routes
if (process.env.NODE_ENV === "development") {
    console.log("⚠️ Development mode: Mock endpoints enabled");
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
// Body parsing middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const httpServer = (0, http_1.createServer)(app);
// Register API routes - pass both httpServer and app
(0, routes_1.registerRoutes)(httpServer, app);
// Serve static files in production
if (process.env.NODE_ENV === "production") {
    (0, static_1.serveStatic)(app);
}
// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong!" });
});
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ CORS configured for: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV}`);
});
