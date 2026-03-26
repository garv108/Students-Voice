import { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerCollegeRoutes(app: Express) {

  app.get("/api/colleges", async (_req, res) => {

    try {

      const result = await db.execute(
        sql`SELECT id, name FROM colleges ORDER BY name`
      );

      res.json(result.rows);

    } catch (error) {

      console.error("Get colleges error:", error);

      res.status(500).json({
        message: "Failed to load colleges"
      });

    }

  });

}