import { Express } from "express";
import { storage } from "../storage";

function requireAdmin(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (req.user?.role !== "admin" && req.user?.role !== "moderator") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
}

export function registerAdminRoutes(app: Express) {

  // ✅ DASHBOARD (FIXED)
  app.get("/api/admin/dashboard", requireAdmin, async (req: any, res) => {
    try {

      const stats = await storage.getAdminStats();
      const complaints = await storage.getLeaderboardComplaints();
      const users = await storage.getAllUsers();
      const abuseLogs = await storage.getAbuseLogs();

      res.json({
        stats,
        complaints,
        users,
        abuseLogs
      });

    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  // ✅ UPDATE ROLE
  app.put("/api/admin/users/:id/role", requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      await storage.updateUserRole(id, role);

      res.json({ success: true });

    } catch (error) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // ✅ UPDATE COMPLAINT
  app.put("/api/admin/complaints/:id", requireAdmin, async (req: any, res) => {
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
      res.status(500).json({ message: "Failed to update complaint" });
    }
  });

  // ✅ BULK DELETE (uses existing function)
  app.delete("/api/admin/complaints/bulk", requireAdmin, async (req: any, res) => {
    try {
      const { ids } = req.body;

      for (const id of ids) {
        await storage.deleteComplaint(id);
      }

      res.json({ success: true });

    } catch (error) {
      res.status(500).json({ message: "Failed to delete complaints" });
    }
  });

}