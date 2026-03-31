import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { requireCollege, CollegeRequest } from "../middleware/college";

function requireAdmin(
  req: CollegeRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  if (req.user.role !== "admin" && req.user.role !== "moderator") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
}

export function registerSettingsRoutes(app: Express) {

  // ✅ GET settings (for frontend)
  app.get(
    "/api/college/settings",
    requireCollege,
    async (req: CollegeRequest & { body: any }, res) => {
        try {

        const settings =
          await storage.getCollegeSettings(
            req.collegeId!
          );

        res.json({
          settings,
        });

      } catch (error) {

        console.error("Get settings error:", error);

        res.status(500).json({
          message: "Failed to load settings",
        });

      }

    }
  );


  // ✅ UPDATE settings (admin only)
  app.post(
    "/api/college/settings",
    requireCollege,
    requireAdmin,
    async (req: CollegeRequest & { body: any }, res) => {

      try {

        await storage.setCollegeSettings(
          req.collegeId!,
          req.body
        );

        res.json({
          success: true,
        });

      } catch (error) {

        console.error("Update settings error:", error);

        res.status(500).json({
          message: "Failed to update settings",
        });

      }

    }
  );

}