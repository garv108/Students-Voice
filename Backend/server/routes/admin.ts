import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";

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

  // Attach user to request for later use
  (req as any).user = user;
  next();
}

export function registerAdminRoutes(app: Express) {

  // DASHBOARD (FIXED - includes users and abuse logs)
  app.get("/api/admin/dashboard", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      // Use the same methods that were working in your original code
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
  app.post("/api/admin/ban", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, until } = req.body;
      await storage.updateUserBan(userId, until);
      res.json({ success: true });
    } catch (error) {
      console.error("Ban error:", error);
      res.status(500).json({ message: "Failed to ban" });
    }
  });

  // UNBAN USER
  app.post("/api/admin/unban", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      await storage.updateUserBan(userId, null);
      res.json({ success: true });
    } catch (error) {
      console.error("Unban error:", error);
      res.status(500).json({ message: "Failed" });
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

      // Assuming your storage has a bulk delete method
      // If not, you can do a loop
      for (const id of ids) {
        await storage.deleteComplaint(id);
      }

      res.json({ success: true });

    } catch (error) {
      console.error("Bulk delete error:", error);
      res.status(500).json({ message: "Failed to delete complaints" });
    }
  });

}