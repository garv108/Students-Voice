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

  next();
}

export function registerAdminRoutes(app: Express) {

  /* ADMIN STATS */

  app.get(
    "/api/admin/stats",
    requireAdmin,
    async (req, res) => {

      try {

        const stats =
          await storage.getAdminStats();

        res.json(stats);

      } catch (error) {

        console.error(
          "Admin stats error:",
          error
        );

        res.status(500).json({
          message:
            "Failed to load stats",
        });

      }

    }
  );


  /* ADMIN USERS */

  app.get(
    "/api/admin/users",
    requireAdmin,
    async (req, res) => {

      try {

        const users =
          await storage.getAllUsers();

        res.json(users);

      } catch (error) {

        console.error(
          "Admin users error:",
          error
        );

        res.status(500).json({
          message:
            "Failed to load users",
        });

      }

    }
  );


  /* BAN USER */

  app.post(
    "/api/admin/ban",
    requireAdmin,
    async (req, res) => {

      try {

        const { userId, until } =
          req.body;

        await storage.updateUserBan(
          userId,
          until
        );

        res.json({
          success: true,
        });

      } catch (error) {

        console.error(
          "Ban error:",
          error
        );

        res.status(500).json({
          message:
            "Failed to ban",
        });

      }

    }
  );


  /* UNBAN */

  app.post(
    "/api/admin/unban",
    requireAdmin,
    async (req, res) => {

      try {

        const { userId } =
          req.body;

        await storage.updateUserBan(
          userId,
          null
        );

        res.json({
          success: true,
        });

      } catch (error) {

        console.error(
          "Unban error:",
          error
        );

        res.status(500).json({
          message:
            "Failed",
        });

      }

    }
  );

  app.get(  "/api/admin/dashboard", requireAdmin, async (req, res) => {
    try {

      const stats = await storage.getAdminStats();
      const complaints = await storage.getLeaderboardComplaints();

      res.json({
        stats,
        complaints
      });

    } catch (error) {

      console.error("Dashboard error:", error);

      res.status(500).json({
        message: "Failed to load dashboard"
      });

       } 
     }
   );
}