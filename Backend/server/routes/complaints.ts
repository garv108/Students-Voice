import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { detectProfanity, getBanExpiration } from "../profanity";
import { analyzeComplaint } from "../gemini";
import { insertComplaintSchema } from "../../shared/schema";
import { z } from "zod";
import { requireCollege, CollegeRequest } from "../middleware/college";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!(req as any).session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const user = await storage.getUser(
    (req as any).session.userId
  );

  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return res.status(403).json({
      message: "Admin access required",
    });
  }

  next();
}

export function registerComplaintRoutes(app: Express) {

  /* CREATE */
  app.post(
    "/api/complaints",
    requireCollege,
    async (req: CollegeRequest & { body: any }, res) => {
      try {
        const user = req.user;

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        if (
          user.bannedUntil &&
          new Date(user.bannedUntil) > new Date()
        ) {
          return res.status(403).json({
            message: "Your account is temporarily banned",
            bannedUntil: user.bannedUntil,
          });
        }

        // Combine originalText and description (AI draft sends 'description')
        const bodyText = req.body.originalText || req.body.description;
        if (!bodyText) {
          return res.status(400).json({ message: "Complaint text is required" });
        }

        // Parse with updated schema (which now accepts optional originalText and description)
        const parseResult = insertComplaintSchema.safeParse({
          ...req.body,
          originalText: bodyText,   // ensure we have the actual text
        });

        if (!parseResult.success) {
          return res.status(400).json({
            message: parseResult.error.errors[0].message,
          });
        }

        const data = parseResult.data;

        const profanityCheck = await detectProfanity(data.originalText!);

        if (profanityCheck.isAbusive) {
          const banUntil = getBanExpiration(3);
          await storage.updateUserBan(user.id, banUntil);
          await storage.createAbuseLog({
            userId: user.id,
            username: user.username,
            flaggedText: data.originalText!,
            detectedWords: profanityCheck.detectedWords,
          });
          return res.status(403).json({
            message: "Inappropriate language detected",
            bannedUntil: banUntil,
          });
        }

        const analysis = await analyzeComplaint(data.originalText!);
        const cluster = await storage.getOrCreateCluster(analysis.keywords);

        const complaint = await storage.createComplaint({
          userId: user.id,
          collegeId: req.collegeId ?? null,
          username: user.username,
          originalText: data.originalText!,
          summary: analysis.summary,
          severity: analysis.severity,
          keywords: analysis.keywords,
          status: data.status || "pending",   // <-- accepts draft/pending
          category: data.category || null,    // <-- new field
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
    }
  );

  /* LEADERBOARD */
  app.get(
    "/api/leaderboard",
    requireCollege,
    async (req: CollegeRequest & { body: any }, res) => {
      try {
        const complaintsData = await storage.getLeaderboardComplaints(req.collegeId!);
        const stats = await storage.getAdminStats();

        res.json({ complaints: complaintsData, stats });
      } catch (error) {
        console.error("Leaderboard error:", error);
        res.status(500).json({ message: "Failed to load leaderboard" });
      }
    }
  );

  /* LIKE */
  app.post(
    "/api/complaints/:id/like",
    requireCollege,
    async (req, res) => {
      try {
        const { id } = req.params;
        const userId = (req as any).session.userId;
        await storage.addLike(id, userId, true);
        res.json({ success: true });
      } catch (error) {
        console.error("Like error:", error);
        res.status(500).json({ message: "Failed" });
      }
    }
  );

  /* DISLIKE */
  app.post(
    "/api/complaints/:id/dislike",
    requireCollege,
    async (req, res) => {
      try {
        const { id } = req.params;
        const userId = (req as any).session.userId;
        await storage.addLike(id, userId, false);
        res.json({ success: true });
      } catch (error) {
        console.error("Dislike error:", error);
        res.status(500).json({ message: "Failed" });
      }
    }
  );

  /* REACT */
  app.post(
    "/api/complaints/:id/react",
    requireCollege,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { emoji } = req.body;
        const userId = (req as any).session.userId;
        await storage.addReaction(id, userId, emoji);
        res.json({ success: true });
      } catch (error) {
        console.error("React error:", error);
        res.status(500).json({ message: "Failed" });
      }
    }
  );

  /* DELETE */
  app.delete(
    "/api/complaints/:id",
    requireCollege,
    async (req, res) => {
      try {
        const { id } = req.params;
        await storage.deleteComplaint(id);
        res.json({ success: true });
      } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ message: "Failed" });
      }
    }
  );
}