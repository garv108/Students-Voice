import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export interface CollegeRequest extends Request<any, any, any> {
  collegeId?: string;
  user?: any;
}

/*
   Middleware
   attaches collegeId to request
*/

export async function requireCollege(
  req: CollegeRequest,
  res: Response,
  next: NextFunction
) {
  try {

    const userId = (req as any).session?.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    // attach user
    req.user = user;

    // super admin bypass (future use)
    if (user.role === "admin") {
      req.collegeId = undefined;
      return next();
    }

    if (!user.collegeId) {
      return res.status(400).json({
        message: "User not linked to college",
      });
    }

    req.collegeId = user.collegeId;

    next();

  } catch (err) {

    console.error("College middleware error", err);

    res.status(500).json({
      message: "Middleware error",
    });

  }
}