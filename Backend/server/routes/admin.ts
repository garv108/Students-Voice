import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { generateReport } from "../reports";
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

  (req as any).user = user;
  next();
}

export function registerAdminRoutes(app: Express) {

  // DASHBOARD
  app.get("/api/admin/dashboard", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getAdminStats();
      const complaints = await storage.getLeaderboardComplaints();
      const users = await storage.getAllUsers();
      const abuseLogs = await storage.getAbuseLogs();

      res.json({
        stats,
        complaints,
        users: users || [],
        abuseLogs: abuseLogs || []
      });

    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  // ADMIN STATS
  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Failed to load stats" });
    }
  });

  // ADMIN USERS
  app.get("/api/admin/users", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Admin users error:", error);
      res.status(500).json({ message: "Failed to load users" });
    }
  });

  // UPDATE USER ROLE
  app.put("/api/admin/users/:id/role", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      await storage.updateUserRole(id, role);
      res.json({ success: true });
    } catch (error) {
      console.error("Update role error:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // BAN USER
  app.put("/api/admin/users/:id/ban", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const { hours } = req.body;
      const hoursNum = parseInt(hours) || 48;
      const banUntil = new Date(Date.now() + hoursNum * 60 * 60 * 1000);
      await storage.updateUserBan(userId, banUntil);
      res.json({ success: true });
    } catch (error) {
      console.error("Ban error:", error);
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  // UNBAN USER
  app.put("/api/admin/users/:id/unban", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      await storage.updateUserBan(userId, null);
      res.json({ success: true });
    } catch (error) {
      console.error("Unban error:", error);
      res.status(500).json({ message: "Failed to unban user" });
    }
  });

  // UPDATE COMPLAINT
  app.put("/api/admin/complaints/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { originalText, status, urgency } = req.body;

      await storage.updateComplaint(id, {
        originalText,
        status,
        urgency
      });

      res.json({ success: true });

    } catch (error) {
      console.error("Update complaint error:", error);
      res.status(500).json({ message: "Failed to update complaint" });
    }
  });

  // BULK DELETE COMPLAINTS
  app.delete("/api/admin/complaints/bulk", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      for (const id of ids) {
        await storage.deleteComplaint(id);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Bulk delete error:", error);
      res.status(500).json({ message: "Failed to delete complaints" });
    }
  });

  // ==================== ANALYTICS ENDPOINT ====================
  app.get("/api/admin/analytics", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const allComplaints = await storage.getComplaints();

      // Group by month
      const byMonth: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      const byStatus: Record<string, number> = {};

      allComplaints.forEach(c => {
        const month = new Date(c.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
        byMonth[month] = (byMonth[month] || 0) + 1;
        const cat = c.category || "Other";
        byCategory[cat] = (byCategory[cat] || 0) + 1;
        bySeverity[c.severity || "average"] = (bySeverity[c.severity || "average"] || 0) + 1;
        byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      });

      res.json({
        total: allComplaints.length,
        byMonth: Object.entries(byMonth).map(([name, count]) => ({ name, count })),
        byCategory: Object.entries(byCategory).map(([name, count]) => ({ name, count })),
        bySeverity: Object.entries(bySeverity).map(([name, count]) => ({ name, count })),
        byStatus: Object.entries(byStatus).map(([name, count]) => ({ name, count })),
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: "Failed to load analytics" });
    }
  });

  // ==================== AI INSIGHTS ENDPOINT ====================
  app.post("/api/admin/insights", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({ message: "AI service not configured" });
      }

      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

      const complaints = await storage.getComplaints();
      const recentComplaints = complaints.slice(0, 50);
      const complaintTexts = recentComplaints.map(c => `[${c.status}] ${c.originalText.slice(0, 200)}`).join("\n");

      const prompt = `
You are an analyst for a student grievance portal. Review the following recent complaints and provide:
1. Top 3 recurring issues or patterns (with count if possible)
2. Any notable spikes in specific categories or locations
3. A one-sentence summary of the overall complaint health

Complaints:
${complaintTexts}

Return ONLY valid JSON:
{
  "patterns": [{ "issue": "string", "count": number, "description": "string" }],
  "spikes": [{ "category": "string", "note": "string" }],
  "summary": "string"
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : { patterns: [], spikes: [], summary: "Could not generate insights." };

      res.json(insights);
    } catch (error: any) {
      console.error("Insights error:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  // ==================== PDF REPORT DOWNLOAD ====================
  app.get(
    "/api/admin/reports/:type",
    requireAuth,
    requireCollege,
    requireAdmin,
    async (req: CollegeRequest, res: Response) => {
      try {
        const reportType = (req as any).params.type;   // <-- FIXED
        const validTypes = ["ugc-annual", "naac-ssr", "icc-annual", "anti-ragging", "sc-st-cell"];
        if (!validTypes.includes(reportType)) {
          return res.status(400).json({ message: "Invalid report type" });
        }

        // Get all non-draft, non-withdrawn complaints
        const allComplaints = await storage.getComplaints();
        const publicComplaints = allComplaints.filter(
          c => c.status !== "draft" && c.status !== "withdrawn"
        );

        // Optionally filter by category for specialised reports
        let filtered = publicComplaints;
        if (reportType === "icc-annual") {
          filtered = publicComplaints.filter(c => c.category === "Harassment");
        } else if (reportType === "anti-ragging") {
          filtered = publicComplaints.filter(c => c.category === "Safety");
        } else if (reportType === "sc-st-cell") {
          filtered = publicComplaints.filter(c => c.category === "Discrimination");
        }

        // Get college name from settings
        let collegeName = "Your Institution";
        if (req.collegeId) {
          const settings = await storage.getCollegeSettings(req.collegeId);
          collegeName = settings?.name || collegeName;
        }

        // Build summary objects
        const summaries = filtered.map(c => ({
          status: c.status,
          category: c.category,
          severity: c.severity,
          urgency: c.urgency,
          createdAt: new Date(c.createdAt),
          solved: c.solved,
        }));

        const pdfBuffer = await generateReport(reportType, summaries, collegeName);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${reportType}-report-${Date.now()}.pdf"`
        );
        res.send(pdfBuffer);
      } catch (error) {
        console.error("Report generation error:", error);
        res.status(500).json({ message: "Failed to generate report" });
      }
    }
  );
}