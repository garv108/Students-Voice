"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const storage_1 = require("./storage");
const crypto_1 = require("crypto");
const util_1 = require("util");
const db_1 = require("./db");
const schema_1 = require("../shared/schema");
const drizzle_orm_1 = require("drizzle-orm");
const notes_storage_1 = require("./notes-storage");
const multer_1 = __importDefault(require("multer"));
const drizzle_orm_2 = require("drizzle-orm");
const auth_1 = require("./routes/auth");
const colleges_1 = require("./routes/colleges");
const complaints_1 = require("./routes/complaints");
const admin_1 = require("./routes/admin");
const settings_1 = require("./routes/settings");
const scryptAsync = (0, util_1.promisify)(crypto_1.scrypt);
async function hashPassword(password) {
    const salt = (0, crypto_1.randomBytes)(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64));
    return `${buf.toString("hex")}.${salt}`;
}
async function comparePasswords(supplied, stored) {
    const [hashedPassword, salt] = stored.split(".");
    const buf = (await scryptAsync(supplied, salt, 64));
    return buf.toString("hex") === hashedPassword;
}
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
    (0, auth_1.registerAuthRoutes)(app);
    (0, colleges_1.registerCollegeRoutes)(app);
    (0, complaints_1.registerComplaintRoutes)(app);
    (0, admin_1.registerAdminRoutes)(app);
    (0, settings_1.registerSettingsRoutes)(app);
    app.get("/admin/clear-ban", async (_req, res) => {
        try {
            await db_1.db.execute((0, drizzle_orm_2.sql) `UPDATE users SET banned_until = NULL`);
            res.json({ message: "All bans cleared" });
        }
        catch (err) {
            console.error("Clear ban error:", err);
            res.status(500).json({ error: "Failed" });
        }
    });
    /* ================= AUTH =====transfered to routes============ */
    /* ================= COLLEGES =====transfered to routes============ */
    /* ================= COMPLAINTS ================= */
    /* ================= ADMIN ================= */
    /* ================= EDUNOTES ================= */
    app.get("/api/notes/categories", async (req, res) => {
        try {
            const categories = await db_1.db.select().from(schema_1.notesCategories);
            res.json(categories);
        }
        catch (error) {
            console.error("Get categories error:", error);
            res.status(500).json({ message: "Failed to load categories" });
        }
    });
    app.get("/api/notes/files/:categoryId", async (req, res) => {
        try {
            const { categoryId } = req.params;
            const files = await db_1.db.select().from(schema_1.notesFiles).where((0, drizzle_orm_1.eq)(schema_1.notesFiles.categoryId, categoryId));
            res.json(files);
        }
        catch (error) {
            console.error("Get files error:", error);
            res.status(500).json({ message: "Failed to load files" });
        }
    });
    app.get("/api/notes/bundles", async (req, res) => {
        try {
            const bundles = await db_1.db.select().from(schema_1.notesBundles);
            res.json(bundles);
        }
        catch (error) {
            console.error("Get bundles error:", error);
            res.status(500).json({ message: "Failed to load bundles" });
        }
    });
    app.post("/api/notes/purchase", requireAuth, async (req, res) => {
        try {
            const { fileId, paymentProof } = req.body;
            const userId = req.session.userId;
            const file = await db_1.db.select().from(schema_1.notesFiles).where((0, drizzle_orm_1.eq)(schema_1.notesFiles.id, fileId)).limit(1);
            if (!file.length) {
                return res.status(404).json({ message: "File not found" });
            }
            const existingPurchase = await db_1.db.select().from(schema_1.notesPurchases)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notesPurchases.buyerId, userId), (0, drizzle_orm_1.eq)(schema_1.notesPurchases.fileId, fileId)))
                .limit(1);
            if (existingPurchase.length) {
                return res.status(400).json({ message: "Already purchased" });
            }
            const purchase = await db_1.db.insert(schema_1.notesPurchases).values({
                buyerId: userId,
                fileId,
                paymentProof,
                paymentStatus: "pending",
            }).returning();
            res.json({ purchase: purchase[0] });
        }
        catch (error) {
            console.error("Purchase error:", error);
            res.status(500).json({ message: "Failed to process purchase" });
        }
    });
    app.get("/api/notes/my-purchases", requireAuth, async (req, res) => {
        try {
            const userId = req.session.userId;
            const purchases = await db_1.db.select().from(schema_1.notesPurchases).where((0, drizzle_orm_1.eq)(schema_1.notesPurchases.buyerId, userId));
            res.json(purchases);
        }
        catch (error) {
            console.error("Get purchases error:", error);
            res.status(500).json({ message: "Failed to load purchases" });
        }
    });
    app.get("/api/notes/download/:fileId", requireAuth, async (req, res) => {
        try {
            const { fileId } = req.params;
            const userId = req.session.userId;
            const purchase = await db_1.db.select().from(schema_1.notesPurchases)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notesPurchases.buyerId, userId), (0, drizzle_orm_1.eq)(schema_1.notesPurchases.fileId, fileId), (0, drizzle_orm_1.eq)(schema_1.notesPurchases.paymentStatus, "verified")))
                .limit(1);
            if (!purchase.length) {
                return res.status(403).json({ message: "Purchase not verified" });
            }
            const file = await db_1.db.select().from(schema_1.notesFiles).where((0, drizzle_orm_1.eq)(schema_1.notesFiles.id, fileId)).limit(1);
            if (!file.length) {
                return res.status(404).json({ message: "File not found" });
            }
            const signedUrl = await (0, notes_storage_1.getSignedUrl)(file[0].filePath);
            res.json({ downloadUrl: signedUrl });
        }
        catch (error) {
            console.error("Download error:", error);
            res.status(500).json({ message: "Failed to generate download link" });
        }
    });
    const upload = (0, multer_1.default)({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit
    app.post("/api/admin/notes/upload", requireAdmin, upload.single("file"), async (req, res) => {
        try {
            const { categoryId, title, description, price } = req.body;
            const file = req.file;
            if (!file) {
                return res.status(400).json({ message: "No file uploaded" });
            }
            const uploadResult = await (0, notes_storage_1.uploadFile)(file.buffer, file.originalname, categoryId);
            const fileRecord = await db_1.db.insert(schema_1.notesFiles).values({
                categoryId,
                title,
                description,
                filePath: uploadResult.path,
                fileSize: file.size,
                price: parseFloat(price) || 0,
            }).returning();
            res.json({ file: fileRecord[0] });
        }
        catch (error) {
            console.error("Upload error:", error);
            res.status(500).json({ message: "Failed to upload file" });
        }
    });
    app.post("/api/admin/notes/category", requireAdmin, async (req, res) => {
        try {
            const { name, branch, semester, subject } = req.body;
            const category = await db_1.db.insert(schema_1.notesCategories).values({
                name,
                branch,
                semester,
                subject,
            }).returning();
            res.json({ category: category[0] });
        }
        catch (error) {
            console.error("Create category error:", error);
            res.status(500).json({ message: "Failed to create category" });
        }
    });
    app.put("/api/admin/notes/purchase/:id/verify", requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { verified } = req.body;
            await db_1.db.update(schema_1.notesPurchases)
                .set({ paymentStatus: verified === true ? "verified" : "pending" })
                .where((0, drizzle_orm_1.eq)(schema_1.notesPurchases.id, id));
            res.json({ success: true });
        }
        catch (error) {
            console.error("Verify purchase error:", error);
            res.status(500).json({ message: "Failed to verify purchase" });
        }
    });
    app.delete("/api/admin/notes/file/:id", requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const file = await db_1.db.select().from(schema_1.notesFiles).where((0, drizzle_orm_1.eq)(schema_1.notesFiles.id, id)).limit(1);
            if (!file.length) {
                return res.status(404).json({ message: "File not found" });
            }
            await (0, notes_storage_1.deleteFile)(file[0].filePath);
            await db_1.db.delete(schema_1.notesFiles).where((0, drizzle_orm_1.eq)(schema_1.notesFiles.id, id));
            res.json({ success: true });
        }
        catch (error) {
            console.error("Delete file error:", error);
            res.status(500).json({ message: "Failed to delete file" });
        }
    });
    return httpServer;
}
