import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { detectProfanity, getBanExpiration } from "./profanity";
import { analyzeComplaint } from "./gemini";
import { insertUserSchema, loginSchema, insertComplaintSchema } from "../shared/schema";
import { z } from "zod";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users, notesCategories, notesFiles, notesBundles, notesPurchases } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { uploadFile, getSignedUrl, deleteFile } from "./notes-storage";
import multer from "multer";
import { sql } from "drizzle-orm";
import { registerAuthRoutes } from "./routes/auth";
import { registerCollegeRoutes } from "./routes/colleges";
import { registerComplaintRoutes } from "./routes/complaints";
import { registerAdminRoutes } from "./routes/admin";
import { registerSettingsRoutes } from "./routes/settings";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashedPassword, salt] = stored.split(".");
  const buf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return buf.toString("hex") === hashedPassword;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const user = await storage.getUser((req as any).session.userId);
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

registerAuthRoutes(app);
registerCollegeRoutes(app);
registerComplaintRoutes(app);
registerAdminRoutes(app);
registerSettingsRoutes(app);


  app.get("/admin/clear-ban", async (_req, res) => {
    try {
      await db.execute(sql`UPDATE users SET banned_until = NULL`);
      res.json({ message: "All bans cleared" });
    } catch (err) {
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
      const categories = await db.select().from(notesCategories);
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ message: "Failed to load categories" });
    }
  });

  app.get("/api/notes/files/:categoryId", async (req, res) => {
    try {
      const { categoryId } = req.params;
      const files = await db.select().from(notesFiles).where(eq(notesFiles.categoryId, categoryId));
      res.json(files);
    } catch (error) {
      console.error("Get files error:", error);
      res.status(500).json({ message: "Failed to load files" });
    }
  });

  app.get("/api/notes/bundles", async (req, res) => {
    try {
      const bundles = await db.select().from(notesBundles);
      res.json(bundles);
    } catch (error) {
      console.error("Get bundles error:", error);
      res.status(500).json({ message: "Failed to load bundles" });
    }
  });

  app.post("/api/notes/purchase", requireAuth, async (req, res) => {
    try {
      const { fileId, paymentProof } = req.body;
      const userId = (req as any).session.userId!;

      const file = await db.select().from(notesFiles).where(eq(notesFiles.id, fileId)).limit(1);
      if (!file.length) {
        return res.status(404).json({ message: "File not found" });
      }

      const existingPurchase = await db.select().from(notesPurchases)
        .where(and(eq(notesPurchases.buyerId, userId), eq(notesPurchases.fileId, fileId)))
        .limit(1);

      if (existingPurchase.length) {
        return res.status(400).json({ message: "Already purchased" });
      }

      const purchase = await db.insert(notesPurchases).values({
        buyerId: userId,
        fileId,
        paymentProof,
        paymentStatus: "pending",
      }).returning();

      res.json({ purchase: purchase[0] });
    } catch (error) {
      console.error("Purchase error:", error);
      res.status(500).json({ message: "Failed to process purchase" });
    }
  });

  app.get("/api/notes/my-purchases", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).session.userId!;
      const purchases = await db.select().from(notesPurchases).where(eq(notesPurchases.buyerId, userId));
      res.json(purchases);
    } catch (error) {
      console.error("Get purchases error:", error);
      res.status(500).json({ message: "Failed to load purchases" });
    }
  });

  app.get("/api/notes/download/:fileId", requireAuth, async (req, res) => {
    try {
      const { fileId } = req.params;
      const userId = (req as any).session.userId!;

      const purchase = await db.select().from(notesPurchases)
        .where(and(
          eq(notesPurchases.buyerId, userId),
          eq(notesPurchases.fileId, fileId),
          eq(notesPurchases.paymentStatus, "verified")
        ))
        .limit(1);

      if (!purchase.length) {
        return res.status(403).json({ message: "Purchase not verified" });
      }

      const file = await db.select().from(notesFiles).where(eq(notesFiles.id, fileId)).limit(1);
      if (!file.length) {
        return res.status(404).json({ message: "File not found" });
      }

      const signedUrl = await getSignedUrl(file[0].filePath);
      res.json({ downloadUrl: signedUrl });
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Failed to generate download link" });
    }
  });

  const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

  app.post("/api/admin/notes/upload", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const { categoryId, title, description, price } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const uploadResult = await uploadFile(file.buffer, file.originalname, categoryId);

      const fileRecord = await db.insert(notesFiles).values({
        categoryId,
        title,
        description,
        filePath: uploadResult.path,
        fileSize: file.size,
        price: parseFloat(price) || 0,
      }).returning();

      res.json({ file: fileRecord[0] });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.post("/api/admin/notes/category", requireAdmin, async (req, res) => {
    try {
      const { name, branch, semester, subject } = req.body;

      const category = await db.insert(notesCategories).values({
        name,
        branch,
        semester,
        subject,
      }).returning();

      res.json({ category: category[0] });
    } catch (error) {
      console.error("Create category error:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/admin/notes/purchase/:id/verify", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { verified } = req.body;

      await db.update(notesPurchases)
        .set({ paymentStatus: verified === true ? "verified" : "pending" })
        .where(eq(notesPurchases.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error("Verify purchase error:", error);
      res.status(500).json({ message: "Failed to verify purchase" });
    }
  });

  app.delete("/api/admin/notes/file/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const file = await db.select().from(notesFiles).where(eq(notesFiles.id, id)).limit(1);
      if (!file.length) {
        return res.status(404).json({ message: "File not found" });
      }

      await deleteFile(file[0].filePath);
      await db.delete(notesFiles).where(eq(notesFiles.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  return httpServer;
}