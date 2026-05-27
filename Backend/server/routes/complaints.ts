import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { detectProfanity, getBanExpiration } from "../profanity";
import { analyzeComplaint, extractKeywords, calculateKeywordOverlap, detectFakeComplaint } from "../gemini";
import { insertComplaintSchema } from "../../shared/schema";
import { z } from "zod";
import { requireCollege, CollegeRequest } from "../middleware/college";
import { getPlatformMode } from "./admin";                 // <-- NEW

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

  const user = await storage.getUser((req as any).session.userId);
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

function computeSLADeadline(urgency: string): Date {
  const now = new Date();
  const days = {
    emergency: 1,
    critical: 3,
    urgent: 7,
    normal: 15,
  }[urgency] || 15;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function registerComplaintRoutes(app: Express) {

  /* CREATE */
  app.post(
    "/api/complaints",
    requireCollege,
    async (req: CollegeRequest & { body: any }, res) => {
      try {
        const user = req.user;
        const mode = getPlatformMode();                    // <-- NEW

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
          return res.status(403).json({
            message: "Your account is temporarily banned",
            bannedUntil: user.bannedUntil,
          });
        }

        // ---------- Platform mode enforcement ----------
        if (mode === "seize") {
          return res.status(503).json({
            message: "The platform is temporarily locked. No new complaints can be submitted at this time."
          });
        }

        const bodyText = req.body.originalText || req.body.description;
        if (!bodyText) {
          return res.status(400).json({ message: "Complaint text is required" });
        }

        const parseResult = insertComplaintSchema.safeParse({
          ...req.body,
          originalText: bodyText,
        });

        if (!parseResult.success) {
          return res.status(400).json({ message: parseResult.error.errors[0].message });
        }

        const data = parseResult.data;

        // Duplicate check
        const userComplaints = await storage.getUserComplaints(user.id);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const duplicate = userComplaints.find(c =>
          c.originalText.trim() === data.originalText!.trim() &&
          new Date(c.createdAt) > oneHourAgo
        );
        if (duplicate) {
          return res.status(409).json({
            message: "You already submitted this complaint recently. Please wait before trying again.",
          });
        }

        // Profanity check
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

        // Fake complaint detection
        const collegeSettingsData = req.collegeId
          ? await storage.getCollegeSettings(req.collegeId)
          : null;
        const knownFacilities: string[] = collegeSettingsData?.features?.facilities || [];
        const fakeCheck = await detectFakeComplaint(data.originalText!, knownFacilities);
        if (fakeCheck.isLikelyFake) {
          const currentWarnings = (user.warnings || 0) + 1;
          await storage.updateUser(user.id, { warnings: currentWarnings });
          if (currentWarnings >= 3) {
            const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await storage.updateUserBan(user.id, thirtyDays);
            return res.status(403).json({
              message:
                "Your complaint appears to reference locations or facilities that do not exist. Your account has been banned for 30 days due to repeated fake submissions.",
              warnings: currentWarnings,
            });
          }
          return res.status(400).json({
            message:
              "Your complaint references locations or facilities that could not be verified. Please check your details. Repeated fake submissions will result in a ban.",
            warnings: currentWarnings,
            reason: fakeCheck.reason,
          });
        }

        const analysis = await analyzeComplaint(data.originalText!);
        const cluster = await storage.getOrCreateCluster(analysis.keywords);

        // In maintenance mode, force draft status
        const finalStatus = (mode === "maintenance") ? "draft" : (data.status || "pending");

        const complaint = await storage.createComplaint({
          userId: user.id,
          collegeId: req.collegeId ?? null,
          username: user.username,
          originalText: data.originalText!,
          summary: analysis.summary,
          severity: analysis.severity,
          keywords: analysis.keywords,
          status: finalStatus,
          category: data.category || null,
          solved: false,
          solvedBy: null,
          solvedAt: null,
          urgency: "normal",
          similarComplaintsCount: cluster ? 1 : 0,
          clusterId: cluster?.id || null,
          likesCount: 0,
          dislikesCount: 0,
          withdrawnAt: null,
          slaDeadline: computeSLADeadline("normal"),
          isAnonymous: data.isAnonymous ?? false,
          isPublic: data.isPublic ?? true,
        });

        if (cluster) {
          await storage.updateClusterCount(cluster.id);
        }

        res.json({
          complaint,
          maintenance: mode === "maintenance",
          message: mode === "maintenance"
            ? "Your complaint has been saved as a draft. It will be submitted automatically when the platform returns to normal."
            : undefined,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors[0].message });
        }
        console.error("Create complaint error:", error);
        res.status(500).json({ message: "Failed to submit complaint" });
      }
    }
  );

  /* MY COMPLAINTS */
  app.get("/api/my-complaints", requireCollege, async (req: CollegeRequest, res) => {
    try {
      const userId = (req as any).session.userId;
      if (!userId) return res.status(401).json({ message: "Not logged in" });
      const complaints = await storage.getUserComplaints(userId);
      res.json(complaints);
    } catch (error) {
      console.error("My complaints error:", error);
      res.status(500).json({ message: "Failed to load your complaints" });
    }
  });

  /* LEADERBOARD */
  app.get("/api/leaderboard", requireCollege, async (req: CollegeRequest, res) => {
    try {
      const complaintsData = await storage.getLeaderboardComplaints(req.collegeId!);
      const publicComplaints = complaintsData.filter(c => c.isPublic !== false);
      const sanitized = publicComplaints.map(c => ({
        ...c,
        username: c.isAnonymous ? "[Anonymous]" : c.username,
      }));
      const stats = {
        total: sanitized.length,
        urgent: sanitized.filter(c => c.urgency === 'urgent').length,
        critical: sanitized.filter(c => c.urgency === 'critical' || c.urgency === 'top_priority').length,
        emergency: sanitized.filter(c => c.urgency === 'emergency').length,
        solved: sanitized.filter(c => c.solved).length,
      };
      res.json({ complaints: sanitized, stats });
    } catch (error) {
      console.error("Leaderboard error:", error);
      res.status(500).json({ message: "Failed to load leaderboard" });
    }
  });

  /* EXPLORE */
  app.get("/api/complaints/explore", requireCollege, async (req: CollegeRequest, res) => {
    try {
      const query = (req as any).query;
      const complaints = await storage.getExploreComplaints({
        search: query.search,
        category: query.category,
        severity: query.severity,
        urgency: query.urgency,
        status: query.status,
        sort: query.sort,
        collegeId: req.collegeId!,
      });
      const publicComplaints = complaints.filter(c => c.isPublic !== false);
      const sanitized = publicComplaints.map(c => ({
        ...c,
        username: c.isAnonymous ? "[Anonymous]" : c.username,
      }));
      res.json({ complaints: sanitized });
    } catch (error) {
      console.error("Explore error:", error);
      res.status(500).json({ message: "Failed to load complaints" });
    }
  });

  /* LIKE */
  app.post("/api/complaints/:id/like", requireCollege, async (req, res) => {
    try {
      if (getPlatformMode() === "seize") {
        return res.status(503).json({ message: "Platform is temporarily locked." });
      }
      const { id } = req.params;
      const userId = (req as any).session.userId;
      await storage.addLike(id, userId, true);
      res.json({ success: true });
    } catch (error) {
      console.error("Like error:", error);
      res.status(500).json({ message: "Failed" });
    }
  });

  /* DISLIKE */
  app.post("/api/complaints/:id/dislike", requireCollege, async (req, res) => {
    try {
      if (getPlatformMode() === "seize") {
        return res.status(503).json({ message: "Platform is temporarily locked." });
      }
      const { id } = req.params;
      const userId = (req as any).session.userId;
      await storage.addLike(id, userId, false);
      res.json({ success: true });
    } catch (error) {
      console.error("Dislike error:", error);
      res.status(500).json({ message: "Failed" });
    }
  });

  /* REACT */
  app.post("/api/complaints/:id/react", requireCollege, async (req, res) => {
    try {
      if (getPlatformMode() === "seize") {
        return res.status(503).json({ message: "Platform is temporarily locked." });
      }
      const { id } = req.params;
      const { emoji } = req.body;
      const userId = (req as any).session.userId;
      await storage.addReaction(id, userId, emoji);
      res.json({ success: true });
    } catch (error) {
      console.error("React error:", error);
      res.status(500).json({ message: "Failed" });
    }
  });

  /* GET SINGLE COMPLAINT */
  app.get("/api/complaints/:id", requireCollege, async (req: CollegeRequest, res) => {
    try {
      const id = (req as any).params.id;
      const userId = (req as any).session.userId;
      const user = req.user;
      const complaint = await storage.getComplaint(id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });
      if (complaint.userId !== userId && user?.role !== "admin" && user?.role !== "moderator") {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(complaint);
    } catch (error) {
      console.error("Get complaint error:", error);
      res.status(500).json({ message: "Failed to load complaint" });
    }
  });

  /* UPDATE COMPLAINT */
  app.put("/api/complaints/:id", requireCollege, async (req: CollegeRequest, res) => {
    try {
      const id = (req as any).params.id;
      const userId = (req as any).session.userId;
      const user = req.user;
      const complaint = await storage.getComplaint(id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });
      if (complaint.userId !== userId && user?.role !== "admin" && user?.role !== "moderator") {
        return res.status(403).json({ message: "You can only edit your own complaints" });
      }
      if (complaint.status !== "draft" && complaint.status !== "pending" && user?.role !== "admin" && user?.role !== "moderator") {
        return res.status(400).json({ message: "Only draft or pending complaints can be edited" });
      }
      const body = (req as any).body || {};
      const updates: any = {};
      if (body.originalText !== undefined) updates.originalText = body.originalText;
      if (body.description !== undefined) updates.originalText = body.description;
      if (body.category !== undefined) updates.category = body.category;
      if (body.severity !== undefined) updates.severity = body.severity;
      if (body.status !== undefined) updates.status = body.status;
      const updated = await storage.updateComplaint(id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Update complaint error:", error);
      res.status(500).json({ message: "Failed to update complaint" });
    }
  });

  /* WITHDRAW */
  app.post("/api/complaints/:id/withdraw", requireCollege, async (req: CollegeRequest, res) => {
    try {
      const id = (req as any).params.id;
      const userId = (req as any).session.userId;
      const complaint = await storage.getComplaint(id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });
      const user = req.user;
      if (complaint.userId !== userId && user?.role !== "admin" && user?.role !== "moderator") {
        return res.status(403).json({ message: "You can only withdraw your own complaints" });
      }
      await storage.updateComplaint(id, { status: "withdrawn", withdrawnAt: new Date() } as any);
      res.json({ success: true });
    } catch (error) {
      console.error("Withdraw error:", error);
      res.status(500).json({ message: "Failed to withdraw complaint" });
    }
  });

  /* RE-RAISE */
  app.post("/api/complaints/:id/reopen", requireCollege, async (req: CollegeRequest, res) => {
    try {
      const id = (req as any).params.id;
      const userId = (req as any).session.userId;
      const user = req.user;
      const complaint = await storage.getComplaint(id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });
      if (complaint.userId !== userId && user?.role !== "admin" && user?.role !== "moderator") {
        return res.status(403).json({ message: "You can only re-raise your own complaints" });
      }
      if (complaint.status !== "withdrawn") {
        return res.status(400).json({ message: "Only withdrawn complaints can be re-raised" });
      }
      const withdrawnAt = complaint.withdrawnAt ? new Date(complaint.withdrawnAt) : null;
      const now = new Date();
      const hoursSince = withdrawnAt ? (now.getTime() - withdrawnAt.getTime()) / (1000 * 60 * 60) : Infinity;
      if (hoursSince > 48) {
        return res.status(400).json({ message: "Re-raise period (48 hours) has expired" });
      }
      await storage.updateComplaint(id, { status: "pending", withdrawnAt: null } as any);
      res.json({ success: true });
    } catch (error) {
      console.error("Re-raise error:", error);
      res.status(500).json({ message: "Failed to re-raise complaint" });
    }
  });

  /* DELETE (Admin only) */
  app.delete("/api/complaints/:id", requireCollege, async (req: CollegeRequest, res) => {
    try {
      const id = (req as any).params.id;
      const user = req.user;
      if (!user || (user.role !== "admin" && user.role !== "moderator")) {
        return res.status(403).json({ message: "Only admins can permanently delete complaints" });
      }
      await storage.deleteComplaint(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ message: "Failed" });
    }
  });

  /* SIMILAR COMPLAINTS */
  app.get("/api/complaints/similar", requireCollege, async (req: CollegeRequest, res) => {
    try {
      const text = (req as any).query.text || "";
      if (!text.trim()) return res.json([]);
      const keywords = extractKeywords(text);
      if (!keywords.length) return res.json([]);
      const recentComplaints = await storage.getLeaderboardComplaints(req.collegeId!);
      const scored = recentComplaints.map(c => ({
        complaint: c,
        score: calculateKeywordOverlap(keywords, c.keywords || []),
      }));
      const matches = scored
        .filter(s => s.score >= 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(s => s.complaint);
      const sanitized = matches.map(c => ({
        ...c,
        username: c.isAnonymous ? "[Anonymous]" : c.username,
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Similar complaints error:", error);
      res.status(500).json({ message: "Failed to find similar issues" });
    }
  });

  /* CHAT – GET MESSAGES */
  app.get("/api/complaints/:id/messages", requireCollege, async (req: CollegeRequest, res) => {
    try {
      const id = (req as any).params.id;
      const userId = (req as any).session.userId;
      const user = req.user;
      const complaint = await storage.getComplaint(id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });
      if (user?.role !== "admin" && user?.role !== "moderator" && complaint.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const messages = await storage.getComplaintMessages(id);
      res.json(messages);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "Failed to load messages" });
    }
  });

  /* CHAT – SEND MESSAGE */
  app.post("/api/complaints/:id/messages", requireCollege, async (req: CollegeRequest, res) => {
    try {
      const id = (req as any).params.id;
      const message = (req as any).body?.message;
      const userId = (req as any).session.userId;
      const user = req.user;
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message cannot be empty" });
      }
      const complaint = await storage.getComplaint(id);
      if (!complaint) return res.status(404).json({ message: "Complaint not found" });
      if (user?.role !== "admin" && user?.role !== "moderator" && complaint.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const newMessage = await storage.createComplaintMessage({
        complaintId: id,
        senderId: userId,
        message: message.trim(),
      });
      res.json(newMessage);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });
}