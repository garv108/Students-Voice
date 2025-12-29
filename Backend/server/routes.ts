import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { detectProfanity, getBanExpiration } from "./profanity";
import { analyzeComplaint } from "./openai";
import { insertUserSchema, loginSchema, insertComplaintSchema } from "../shared/schema";
import { z } from "zod";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

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
  // Session middleware is now in index.ts to avoid duplicates

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);

      const existingUsername = await storage.getUserByUsername(data.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const user = await storage.createUser(data);
      (req as any).session.userId = user.id;

      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.validatePassword(data.username, data.password);

      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      (req as any).session.userId = user.id;
      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    (req as any).session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = (req as any).session.userId;

      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValid = await comparePasswords(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password in database
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, userId));

      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!(req as any).session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser((req as any).session.userId);
    if (!user) {
      (req as any).session.destroy(() => {});
      return res.status(401).json({ message: "User not found" });
    }

    res.json({ user: { ...user, password: undefined } });
  });

  app.post("/api/complaints", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
        return res.status(403).json({ 
          message: "Your account is temporarily banned",
          bannedUntil: user.bannedUntil
        });
      }

      const data = insertComplaintSchema.parse(req.body);

      const profanityCheck = detectProfanity(data.originalText);
      if (profanityCheck.isAbusive) {
        const banUntil = getBanExpiration(48);
        await storage.updateUserBan(user.id, banUntil);

        await storage.createAbuseLog({
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

      const analysis = await analyzeComplaint(data.originalText);

      const cluster = await storage.getOrCreateCluster(analysis.keywords);

      const complaint = await storage.createComplaint({
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
        await storage.updateClusterCount(cluster.id);
      }

      res.json({ complaint });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create complaint error:", error);
      res.status(500).json({ message: "Failed to submit complaint" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const complaintsData = await storage.getLeaderboardComplaints();
      const stats = await storage.getAdminStats();
      const userId = (req as any).session.userId;

      const complaintsWithReactions = await Promise.all(
        complaintsData.map(async (complaint) => {
          const reactionCounts = await storage.getReactionCounts(complaint.id);
          let userLiked = false;
          let userDisliked = false;
          let userReactions: string[] = [];

          if (userId) {
            const like = await storage.getUserLike(complaint.id, userId);
            if (like) {
              userLiked = like.isLike;
              userDisliked = !like.isLike;
            }
            userReactions = await storage.getUserReactions(complaint.id, userId);
          }

          return {
            ...complaint,
            reactions: reactionCounts,
            userLiked,
            userDisliked,
            userReactions,
          };
        })
      );

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
    } catch (error) {
      console.error("Leaderboard error:", error);
      res.status(500).json({ message: "Failed to load leaderboard" });
    }
  });

  app.post("/api/complaints/:id/like", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).session.userId!;

      await storage.addLike(id, userId, true);
      res.json({ success: true });
    } catch (error) {
      console.error("Like error:", error);
      res.status(500).json({ message: "Failed to like" });
    }
  });

  app.post("/api/complaints/:id/dislike", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).session.userId!;

      await storage.addLike(id, userId, false);
      res.json({ success: true });
    } catch (error) {
      console.error("Dislike error:", error);
      res.status(500).json({ message: "Failed to dislike" });
    }
  });

  app.post("/api/complaints/:id/react", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { emoji } = req.body;
      const userId = (req as any).session.userId!;

      if (!emoji || typeof emoji !== "string") {
        return res.status(400).json({ message: "Emoji required" });
      }

      await storage.addReaction(id, userId, emoji);
      res.json({ success: true });
    } catch (error) {
      console.error("React error:", error);
      res.status(500).json({ message: "Failed to react" });
    }
  });

  app.put("/api/complaints/:id/solve", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).session.userId!;

      const existing = await storage.getComplaint(id);
      if (!existing) {
        return res.status(404).json({ message: "Complaint not found" });
      }

      const complaint = await storage.updateComplaint(id, {
        solved: true,
        solvedBy: userId,
        solvedAt: new Date(),
        status: "solved",
        urgency: "normal",
        similarComplaintsCount: 0,
      });

      if (existing.clusterId) {
        await storage.updateClusterCount(existing.clusterId);
      }

      res.json({ complaint });
    } catch (error) {
      console.error("Solve error:", error);
      res.status(500).json({ message: "Failed to mark as solved" });
    }
  });

  app.delete("/api/complaints/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).session.userId!;

      const complaint = await storage.getComplaint(id);
      if (!complaint) {
        return res.status(404).json({ message: "Complaint not found" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const isOwner = complaint.userId === userId;
      const isAdmin = user.role === "admin" || user.role === "moderator";

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this complaint" });
      }

      await storage.deleteComplaint(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ message: "Failed to delete complaint" });
    }
  });

  app.get("/api/admin/dashboard", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      const complaints = await storage.getComplaints();
      const users = await storage.getAllUsers();
      const abuseLogs = await storage.getAbuseLogs();

      res.json({
        stats,
        complaints,
        users: users.map((u) => ({ ...u, password: undefined })),
        abuseLogs,
      });
    } catch (error) {
      console.error("Admin dashboard error:", error);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  app.put("/api/admin/complaints/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { originalText, status } = req.body;

      const existing = await storage.getComplaint(id);
      if (!existing) {
        return res.status(404).json({ message: "Complaint not found" });
      }

      const updates: any = {};
      if (originalText !== undefined) updates.originalText = originalText;
      if (status !== undefined) {
        updates.status = status;
        if (status === "solved") {
          updates.solved = true;
          updates.solvedBy = (req as any).session.userId;
          updates.solvedAt = new Date();
          updates.urgency = "normal";
          updates.similarComplaintsCount = 0;
        } else if (status === "pending" || status === "in_progress") {
          updates.solved = false;
          updates.solvedBy = null;
          updates.solvedAt = null;
        }
      }

      const complaint = await storage.updateComplaint(id, updates);

      if (existing.clusterId && status && existing.status !== status) {
        await storage.updateClusterCount(existing.clusterId);
      }

      res.json({ complaint });
    } catch (error) {
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

      await storage.deleteComplaintsBulk(ids);
      res.json({ success: true, deleted: ids.length });
    } catch (error) {
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

      await storage.updateUserRole(id, role);
      res.json({ success: true });
    } catch (error) {
      console.error("Update role error:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.put("/api/admin/users/:id/ban", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { hours } = req.body;

      const banUntil = getBanExpiration(hours || 48);
      await storage.updateUserBan(id, banUntil);
      res.json({ success: true, bannedUntil: banUntil });
    } catch (error) {
      console.error("Ban user error:", error);
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  app.put("/api/admin/users/:id/unban", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.updateUserBan(id, null);
      res.json({ success: true });
    } catch (error) {
      console.error("Unban user error:", error);
      res.status(500).json({ message: "Failed to unban user" });
    }
  });

  return httpServer;
}