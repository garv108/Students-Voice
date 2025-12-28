"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const express_session_1 = __importDefault(require("express-session"));
const storage_1 = require("./storage");
const profanity_1 = require("./profanity");
const openai_1 = require("./openai");
const schema_1 = require("../shared/schema");
const zod_1 = require("zod");
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ message: "Authentication required" });
    }
    next();
}
async function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ message: "Authentication required" });
    }
    const user = await storage_1.storage.getUser(req.session.userId);
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
        return res.status(403).json({ message: "Admin access required" });
    }
    next();
}
async function registerRoutes(httpServer, app) {
    app.use((0, express_session_1.default)({
        secret: process.env.SESSION_SECRET || "studentvoice-secret-key",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        },
    }));
    app.post("/api/auth/signup", async (req, res) => {
        try {
            const data = schema_1.insertUserSchema.parse(req.body);
            const existingUsername = await storage_1.storage.getUserByUsername(data.username);
            if (existingUsername) {
                return res.status(400).json({ message: "Username already taken" });
            }
            const existingEmail = await storage_1.storage.getUserByEmail(data.email);
            if (existingEmail) {
                return res.status(400).json({ message: "Email already registered" });
            }
            const user = await storage_1.storage.createUser(data);
            req.session.userId = user.id;
            res.json({ user: { ...user, password: undefined } });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: error.errors[0].message });
            }
            console.error("Signup error:", error);
            res.status(500).json({ message: "Failed to create account" });
        }
    });
    app.post("/api/auth/login", async (req, res) => {
        try {
            const data = schema_1.loginSchema.parse(req.body);
            const user = await storage_1.storage.validatePassword(data.username, data.password);
            if (!user) {
                return res.status(401).json({ message: "Invalid username or password" });
            }
            req.session.userId = user.id;
            res.json({ user: { ...user, password: undefined } });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: error.errors[0].message });
            }
            console.error("Login error:", error);
            res.status(500).json({ message: "Login failed" });
        }
    });
    app.post("/api/auth/logout", (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ message: "Logout failed" });
            }
            res.json({ message: "Logged out successfully" });
        });
    });
    app.get("/api/auth/me", async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        const user = await storage_1.storage.getUser(req.session.userId);
        if (!user) {
            req.session.destroy(() => { });
            return res.status(401).json({ message: "User not found" });
        }
        res.json({ user: { ...user, password: undefined } });
    });
    app.post("/api/complaints", requireAuth, async (req, res) => {
        try {
            const user = await storage_1.storage.getUser(req.session.userId);
            if (!user) {
                return res.status(401).json({ message: "User not found" });
            }
            if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
                return res.status(403).json({
                    message: "Your account is temporarily banned",
                    bannedUntil: user.bannedUntil
                });
            }
            const data = schema_1.insertComplaintSchema.parse(req.body);
            const profanityCheck = (0, profanity_1.detectProfanity)(data.originalText);
            if (profanityCheck.isAbusive) {
                const banUntil = (0, profanity_1.getBanExpiration)(48);
                await storage_1.storage.updateUserBan(user.id, banUntil);
                await storage_1.storage.createAbuseLog({
                    userId: user.id,
                    username: user.username,
                    flaggedText: data.originalText,
                    detectedWords: profanityCheck.detectedWords,
                });
                return res.status(403).json({
                    message: "Your submission contains inappropriate language. Your account has been suspended for 48 hours.",
                    bannedUntil: banUntil,
                });
            }
            const analysis = await (0, openai_1.analyzeComplaint)(data.originalText);
            const cluster = await storage_1.storage.getOrCreateCluster(analysis.keywords);
            const complaint = await storage_1.storage.createComplaint({
                userId: user.id,
                username: user.username,
                originalText: data.originalText,
                summary: analysis.summary,
                severity: analysis.severity,
                keywords: analysis.keywords,
                status: "pending",
                solved: false,
                solvedBy: null,
                solvedAt: null,
                urgency: "normal",
                similarComplaintsCount: cluster ? 1 : 0,
                clusterId: cluster?.id || null,
                likesCount: 0,
                dislikesCount: 0,
            });
            if (cluster) {
                await storage_1.storage.updateClusterCount(cluster.id);
            }
            res.json({ complaint });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return res.status(400).json({ message: error.errors[0].message });
            }
            console.error("Create complaint error:", error);
            res.status(500).json({ message: "Failed to submit complaint" });
        }
    });
    app.get("/api/leaderboard", async (req, res) => {
        try {
            const complaintsData = await storage_1.storage.getLeaderboardComplaints();
            const stats = await storage_1.storage.getAdminStats();
            const userId = req.session.userId;
            const complaintsWithReactions = await Promise.all(complaintsData.map(async (complaint) => {
                const reactionCounts = await storage_1.storage.getReactionCounts(complaint.id);
                let userLiked = false;
                let userDisliked = false;
                let userReactions = [];
                if (userId) {
                    const like = await storage_1.storage.getUserLike(complaint.id, userId);
                    if (like) {
                        userLiked = like.isLike;
                        userDisliked = !like.isLike;
                    }
                    userReactions = await storage_1.storage.getUserReactions(complaint.id, userId);
                }
                return {
                    ...complaint,
                    reactions: reactionCounts,
                    userLiked,
                    userDisliked,
                    userReactions,
                };
            }));
            res.json({
                complaints: complaintsWithReactions,
                stats: {
                    total: stats.totalComplaints,
                    urgent: stats.urgentCount,
                    critical: stats.criticalCount,
                    emergency: stats.emergencyCount,
                    solved: stats.solvedComplaints,
                },
            });
        }
        catch (error) {
            console.error("Leaderboard error:", error);
            res.status(500).json({ message: "Failed to load leaderboard" });
        }
    });
    app.post("/api/complaints/:id/like", requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            await storage_1.storage.addLike(id, userId, true);
            res.json({ success: true });
        }
        catch (error) {
            console.error("Like error:", error);
            res.status(500).json({ message: "Failed to like" });
        }
    });
    app.post("/api/complaints/:id/dislike", requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            await storage_1.storage.addLike(id, userId, false);
            res.json({ success: true });
        }
        catch (error) {
            console.error("Dislike error:", error);
            res.status(500).json({ message: "Failed to dislike" });
        }
    });
    app.post("/api/complaints/:id/react", requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const { emoji } = req.body;
            const userId = req.session.userId;
            if (!emoji || typeof emoji !== "string") {
                return res.status(400).json({ message: "Emoji required" });
            }
            await storage_1.storage.addReaction(id, userId, emoji);
            res.json({ success: true });
        }
        catch (error) {
            console.error("React error:", error);
            res.status(500).json({ message: "Failed to react" });
        }
    });
    app.put("/api/complaints/:id/solve", requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            const existing = await storage_1.storage.getComplaint(id);
            if (!existing) {
                return res.status(404).json({ message: "Complaint not found" });
            }
            const complaint = await storage_1.storage.updateComplaint(id, {
                solved: true,
                solvedBy: userId,
                solvedAt: new Date(),
                status: "solved",
                urgency: "normal",
                similarComplaintsCount: 0,
            });
            if (existing.clusterId) {
                await storage_1.storage.updateClusterCount(existing.clusterId);
            }
            res.json({ complaint });
        }
        catch (error) {
            console.error("Solve error:", error);
            res.status(500).json({ message: "Failed to mark as solved" });
        }
    });
    app.delete("/api/complaints/:id", requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.session.userId;
            const complaint = await storage_1.storage.getComplaint(id);
            if (!complaint) {
                return res.status(404).json({ message: "Complaint not found" });
            }
            const user = await storage_1.storage.getUser(userId);
            if (!user) {
                return res.status(401).json({ message: "User not found" });
            }
            const isOwner = complaint.userId === userId;
            const isAdmin = user.role === "admin" || user.role === "moderator";
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ message: "Not authorized to delete this complaint" });
            }
            await storage_1.storage.deleteComplaint(id);
            res.json({ success: true });
        }
        catch (error) {
            console.error("Delete error:", error);
            res.status(500).json({ message: "Failed to delete complaint" });
        }
    });
    app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
        try {
            const stats = await storage_1.storage.getAdminStats();
            const complaints = await storage_1.storage.getComplaints();
            const users = await storage_1.storage.getAllUsers();
            const abuseLogs = await storage_1.storage.getAbuseLogs();
            res.json({
                stats,
                complaints,
                users: users.map((u) => ({ ...u, password: undefined })),
                abuseLogs,
            });
        }
        catch (error) {
            console.error("Admin dashboard error:", error);
            res.status(500).json({ message: "Failed to load dashboard" });
        }
    });
    app.put("/api/admin/complaints/:id", requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { originalText, status } = req.body;
            const existing = await storage_1.storage.getComplaint(id);
            if (!existing) {
                return res.status(404).json({ message: "Complaint not found" });
            }
            const updates = {};
            if (originalText !== undefined)
                updates.originalText = originalText;
            if (status !== undefined) {
                updates.status = status;
                if (status === "solved") {
                    updates.solved = true;
                    updates.solvedBy = req.session.userId;
                    updates.solvedAt = new Date();
                    updates.urgency = "normal";
                    updates.similarComplaintsCount = 0;
                }
                else if (status === "pending" || status === "in_progress") {
                    updates.solved = false;
                    updates.solvedBy = null;
                    updates.solvedAt = null;
                }
            }
            const complaint = await storage_1.storage.updateComplaint(id, updates);
            if (existing.clusterId && status && existing.status !== status) {
                await storage_1.storage.updateClusterCount(existing.clusterId);
            }
            res.json({ complaint });
        }
        catch (error) {
            console.error("Admin edit error:", error);
            res.status(500).json({ message: "Failed to update complaint" });
        }
    });
    app.delete("/api/admin/complaints/bulk", requireAdmin, async (req, res) => {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids)) {
                return res.status(400).json({ message: "IDs array required" });
            }
            await storage_1.storage.deleteComplaintsBulk(ids);
            res.json({ success: true, deleted: ids.length });
        }
        catch (error) {
            console.error("Bulk delete error:", error);
            res.status(500).json({ message: "Failed to delete complaints" });
        }
    });
    app.put("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { role } = req.body;
            if (!["student", "moderator", "admin"].includes(role)) {
                return res.status(400).json({ message: "Invalid role" });
            }
            await storage_1.storage.updateUserRole(id, role);
            res.json({ success: true });
        }
        catch (error) {
            console.error("Update role error:", error);
            res.status(500).json({ message: "Failed to update role" });
        }
    });
    app.put("/api/admin/users/:id/ban", requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { hours } = req.body;
            const banUntil = (0, profanity_1.getBanExpiration)(hours || 48);
            await storage_1.storage.updateUserBan(id, banUntil);
            res.json({ success: true, bannedUntil: banUntil });
        }
        catch (error) {
            console.error("Ban user error:", error);
            res.status(500).json({ message: "Failed to ban user" });
        }
    });
    app.put("/api/admin/users/:id/unban", requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            await storage_1.storage.updateUserBan(id, null);
            res.json({ success: true });
        }
        catch (error) {
            console.error("Unban user error:", error);
            res.status(500).json({ message: "Failed to unban user" });
        }
    });
    return httpServer;
}
