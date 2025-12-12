import {
  users,
  complaints,
  reactions,
  likes,
  abuseLogs,
  clusterGroups,
  type User,
  type InsertUser,
  type Complaint,
  type InsertComplaint,
  type Reaction,
  type InsertReaction,
  type Like,
  type AbuseLog,
  type ClusterGroup,
  calculateUrgency,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, gte, count } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

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

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  validatePassword(username: string, password: string): Promise<User | null>;
  updateUserBan(userId: string, bannedUntil: Date | null): Promise<void>;
  updateUserRole(userId: string, role: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  createComplaint(complaint: Omit<Complaint, "id" | "createdAt">): Promise<Complaint>;
  getComplaint(id: string): Promise<Complaint | undefined>;
  getComplaints(): Promise<Complaint[]>;
  getLeaderboardComplaints(): Promise<Complaint[]>;
  updateComplaint(id: string, updates: Partial<Complaint>): Promise<Complaint | undefined>;
  deleteComplaint(id: string): Promise<void>;
  deleteComplaintsBulk(ids: string[]): Promise<void>;
  
  addLike(complaintId: string, userId: string, isLike: boolean): Promise<void>;
  removeLike(complaintId: string, userId: string): Promise<void>;
  getUserLike(complaintId: string, userId: string): Promise<Like | undefined>;
  
  addReaction(complaintId: string, userId: string, emoji: string): Promise<void>;
  removeReaction(complaintId: string, userId: string, emoji: string): Promise<void>;
  getReactionCounts(complaintId: string): Promise<{ emoji: string; count: number }[]>;
  getUserReactions(complaintId: string, userId: string): Promise<string[]>;
  
  createAbuseLog(log: Omit<AbuseLog, "id" | "createdAt">): Promise<AbuseLog>;
  getAbuseLogs(): Promise<AbuseLog[]>;
  
  getOrCreateCluster(keywords: string[]): Promise<ClusterGroup | null>;
  updateClusterCount(clusterId: string): Promise<void>;
  recalculateUrgencies(): Promise<void>;
  
  getAdminStats(): Promise<{
    totalComplaints: number;
    pendingComplaints: number;
    solvedComplaints: number;
    urgentCount: number;
    criticalCount: number;
    emergencyCount: number;
    totalUsers: number;
    bannedUsers: number;
    abuseLogs: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await hashPassword(insertUser.password);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  async validatePassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    const isValid = await comparePasswords(password, user.password);
    return isValid ? user : null;
  }

  async updateUserBan(userId: string, bannedUntil: Date | null): Promise<void> {
    await db.update(users).set({ bannedUntil }).where(eq(users.id, userId));
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    await db.update(users).set({ role: role as any }).where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createComplaint(complaint: Omit<Complaint, "id" | "createdAt">): Promise<Complaint> {
    const [created] = await db.insert(complaints).values(complaint).returning();
    return created;
  }

  async getComplaint(id: string): Promise<Complaint | undefined> {
    const [complaint] = await db.select().from(complaints).where(eq(complaints.id, id));
    return complaint || undefined;
  }

  async getComplaints(): Promise<Complaint[]> {
    return db.select().from(complaints).orderBy(desc(complaints.createdAt));
  }

  async getLeaderboardComplaints(): Promise<Complaint[]> {
    return db
      .select()
      .from(complaints)
      .orderBy(desc(complaints.similarComplaintsCount), desc(complaints.likesCount), desc(complaints.createdAt));
  }

  async updateComplaint(id: string, updates: Partial<Complaint>): Promise<Complaint | undefined> {
    const [updated] = await db
      .update(complaints)
      .set(updates)
      .where(eq(complaints.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteComplaint(id: string): Promise<void> {
    const complaint = await this.getComplaint(id);
    const clusterId = complaint?.clusterId;
    
    await db.delete(likes).where(eq(likes.complaintId, id));
    await db.delete(reactions).where(eq(reactions.complaintId, id));
    await db.delete(complaints).where(eq(complaints.id, id));
    
    if (clusterId) {
      await this.updateClusterCount(clusterId);
    }
  }

  async deleteComplaintsBulk(ids: string[]): Promise<void> {
    const clusterIds = new Set<string>();
    
    for (const id of ids) {
      const complaint = await this.getComplaint(id);
      if (complaint?.clusterId) {
        clusterIds.add(complaint.clusterId);
      }
      await db.delete(likes).where(eq(likes.complaintId, id));
      await db.delete(reactions).where(eq(reactions.complaintId, id));
      await db.delete(complaints).where(eq(complaints.id, id));
    }
    
    for (const clusterId of Array.from(clusterIds)) {
      await this.updateClusterCount(clusterId);
    }
  }

  async addLike(complaintId: string, userId: string, isLike: boolean): Promise<void> {
    const existing = await this.getUserLike(complaintId, userId);
    
    if (existing) {
      if (existing.isLike === isLike) {
        await db.delete(likes).where(eq(likes.id, existing.id));
        await db.update(complaints).set({
          likesCount: isLike ? sql`${complaints.likesCount} - 1` : complaints.likesCount,
          dislikesCount: !isLike ? sql`${complaints.dislikesCount} - 1` : complaints.dislikesCount,
        }).where(eq(complaints.id, complaintId));
      } else {
        await db.update(likes).set({ isLike }).where(eq(likes.id, existing.id));
        await db.update(complaints).set({
          likesCount: isLike ? sql`${complaints.likesCount} + 1` : sql`${complaints.likesCount} - 1`,
          dislikesCount: !isLike ? sql`${complaints.dislikesCount} + 1` : sql`${complaints.dislikesCount} - 1`,
        }).where(eq(complaints.id, complaintId));
      }
    } else {
      await db.insert(likes).values({ complaintId, userId, isLike });
      await db.update(complaints).set({
        likesCount: isLike ? sql`${complaints.likesCount} + 1` : complaints.likesCount,
        dislikesCount: !isLike ? sql`${complaints.dislikesCount} + 1` : complaints.dislikesCount,
      }).where(eq(complaints.id, complaintId));
    }
  }

  async removeLike(complaintId: string, userId: string): Promise<void> {
    const existing = await this.getUserLike(complaintId, userId);
    if (existing) {
      await db.delete(likes).where(eq(likes.id, existing.id));
      await db.update(complaints).set({
        likesCount: existing.isLike ? sql`${complaints.likesCount} - 1` : complaints.likesCount,
        dislikesCount: !existing.isLike ? sql`${complaints.dislikesCount} - 1` : complaints.dislikesCount,
      }).where(eq(complaints.id, complaintId));
    }
  }

  async getUserLike(complaintId: string, userId: string): Promise<Like | undefined> {
    const [like] = await db
      .select()
      .from(likes)
      .where(and(eq(likes.complaintId, complaintId), eq(likes.userId, userId)));
    return like || undefined;
  }

  async addReaction(complaintId: string, userId: string, emoji: string): Promise<void> {
    const existing = await db
      .select()
      .from(reactions)
      .where(
        and(
          eq(reactions.complaintId, complaintId),
          eq(reactions.userId, userId),
          eq(reactions.emoji, emoji)
        )
      );
    
    if (existing.length > 0) {
      await db.delete(reactions).where(eq(reactions.id, existing[0].id));
    } else {
      await db.insert(reactions).values({ complaintId, userId, emoji });
    }
  }

  async removeReaction(complaintId: string, userId: string, emoji: string): Promise<void> {
    await db
      .delete(reactions)
      .where(
        and(
          eq(reactions.complaintId, complaintId),
          eq(reactions.userId, userId),
          eq(reactions.emoji, emoji)
        )
      );
  }

  async getReactionCounts(complaintId: string): Promise<{ emoji: string; count: number }[]> {
    const result = await db
      .select({
        emoji: reactions.emoji,
        count: count(),
      })
      .from(reactions)
      .where(eq(reactions.complaintId, complaintId))
      .groupBy(reactions.emoji);
    
    return result.map(r => ({ emoji: r.emoji, count: Number(r.count) }));
  }

  async getUserReactions(complaintId: string, userId: string): Promise<string[]> {
    const result = await db
      .select({ emoji: reactions.emoji })
      .from(reactions)
      .where(and(eq(reactions.complaintId, complaintId), eq(reactions.userId, userId)));
    
    return result.map(r => r.emoji);
  }

  async createAbuseLog(log: Omit<AbuseLog, "id" | "createdAt">): Promise<AbuseLog> {
    const [created] = await db.insert(abuseLogs).values(log).returning();
    return created;
  }

  async getAbuseLogs(): Promise<AbuseLog[]> {
    return db.select().from(abuseLogs).orderBy(desc(abuseLogs.createdAt));
  }

  async getOrCreateCluster(keywords: string[]): Promise<ClusterGroup | null> {
    if (!keywords || keywords.length === 0) return null;

    const existingClusters = await db.select().from(clusterGroups);
    
    for (const cluster of existingClusters) {
      if (cluster.keywords) {
        const clusterKeywords = cluster.keywords;
        const overlap = this.calculateKeywordOverlap(keywords, clusterKeywords);
        if (overlap >= 0.3) {
          return cluster;
        }
      }
    }

    const [newCluster] = await db
      .insert(clusterGroups)
      .values({
        keywords,
        problemCount: 1,
        urgency: "normal",
      })
      .returning();
    
    return newCluster;
  }

  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1.map(k => k.toLowerCase()));
    const set2 = new Set(keywords2.map(k => k.toLowerCase()));
    
    let overlap = 0;
    for (const keyword of Array.from(set1)) {
      if (set2.has(keyword)) overlap++;
    }
    
    const totalUnique = new Set([...Array.from(set1), ...Array.from(set2)]).size;
    return totalUnique > 0 ? overlap / totalUnique : 0;
  }

  async updateClusterCount(clusterId: string): Promise<void> {
    const activeComplaintsInCluster = await db
      .select({ count: count() })
      .from(complaints)
      .where(and(eq(complaints.clusterId, clusterId), eq(complaints.solved, false)));
    
    const activeCount = Number(activeComplaintsInCluster[0]?.count || 0);
    const urgency = calculateUrgency(activeCount);

    await db
      .update(clusterGroups)
      .set({ problemCount: activeCount, urgency, lastUpdated: new Date() })
      .where(eq(clusterGroups.id, clusterId));

    await db
      .update(complaints)
      .set({ similarComplaintsCount: activeCount, urgency })
      .where(and(eq(complaints.clusterId, clusterId), eq(complaints.solved, false)));
  }

  async recalculateUrgencies(): Promise<void> {
    const allClusters = await db.select().from(clusterGroups);
    for (const cluster of allClusters) {
      await this.updateClusterCount(cluster.id);
    }
  }

  async getAdminStats(): Promise<{
    totalComplaints: number;
    pendingComplaints: number;
    solvedComplaints: number;
    urgentCount: number;
    criticalCount: number;
    emergencyCount: number;
    totalUsers: number;
    bannedUsers: number;
    abuseLogs: number;
  }> {
    const allComplaints = await db.select().from(complaints);
    const allUsers = await db.select().from(users);
    const allAbuseLogs = await db.select().from(abuseLogs);

    const now = new Date();

    return {
      totalComplaints: allComplaints.length,
      pendingComplaints: allComplaints.filter(c => c.status === "pending").length,
      solvedComplaints: allComplaints.filter(c => c.solved).length,
      urgentCount: allComplaints.filter(c => c.urgency === "urgent").length,
      criticalCount: allComplaints.filter(c => c.urgency === "critical" || c.urgency === "top_priority").length,
      emergencyCount: allComplaints.filter(c => c.urgency === "emergency").length,
      totalUsers: allUsers.length,
      bannedUsers: allUsers.filter(u => u.bannedUntil && new Date(u.bannedUntil) > now).length,
      abuseLogs: allAbuseLogs.length,
    };
  }
}

export const storage = new DatabaseStorage();
