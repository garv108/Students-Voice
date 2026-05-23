﻿import {
  users,
  complaints,
  reactions,
  likes,
  abuseLogs,
  clusterGroups,
  collegeSettings,
  complaintMessages,
  type User,
  type InsertUser,
  type Complaint,
  type InsertComplaint,
  type Reaction,
  type InsertReaction,
  type Like,
  type AbuseLog,
  type ClusterGroup,
  type ComplaintMessage,
  type InsertComplaintMessage,
  calculateUrgency,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, count, ilike } from "drizzle-orm";   // ← added or, ilike
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
  updateUser(userId: string, updates: Partial<User>): Promise<User | undefined>;
  
  setVerificationToken(userId: string, token: string, expiry: Date): Promise<void>;
  verifyUser(token: string): Promise<boolean>;
  isUserVerified(userId: string): Promise<boolean>;
  
  createComplaint(complaint: Omit<Complaint, "id" | "createdAt">): Promise<Complaint>;
  getComplaint(id: string): Promise<Complaint | undefined>;
  getComplaints(): Promise<Complaint[]>;
  getLeaderboardComplaints(collegeId?: string): Promise<Complaint[]>;
  getUserComplaints(userId: string): Promise<Complaint[]>;
  getExploreComplaints(filters: {                        // ← NEW signature
    search?: string;
    category?: string;
    severity?: string;
    urgency?: string;
    status?: string;
    collegeId?: string;
    sort?: "recent" | "likes" | "urgency";
  }): Promise<Complaint[]>;
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
  
  getAdminStats(collegeId?: string): Promise<{
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

  getComplaintMessages(complaintId: string): Promise<ComplaintMessage[]>;
  createComplaintMessage(msg: InsertComplaintMessage): Promise<ComplaintMessage>;
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
    const [user] = await db
      .insert(users)
      .values(insertUser)
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

  async updateUser(userId: string, updates: Partial<User>): Promise<User | undefined> {
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async setVerificationToken(userId: string, token: string, expiry: Date): Promise<void> {
    await db
      .update(users)
      .set({
        verificationToken: token,
        verificationTokenExpiry: expiry,
      })
      .where(eq(users.id, userId));
  }

  async verifyUser(token: string): Promise<boolean> {
    const now = new Date();
    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.verificationToken, token),
          sql`${users.verificationTokenExpiry} > ${now}`
        )
      );
    if (!user) return false;
    await db
      .update(users)
      .set({
        isVerified: true,
        verifiedAt: now,
        verificationToken: null,
        verificationTokenExpiry: null,
      })
      .where(eq(users.id, user.id));
    return true;
  }

  async isUserVerified(userId: string): Promise<boolean> {
    const [user] = await db
      .select({ isVerified: users.isVerified })
      .from(users)
      .where(eq(users.id, userId));
    return user?.isVerified || false;
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

  async getLeaderboardComplaints(collegeId?: string): Promise<Complaint[]> {
    if (collegeId) {
      return db
        .select()
        .from(complaints)
        .where(and(
          eq(complaints.collegeId, collegeId),
          sql`${complaints.status} NOT IN ('draft', 'withdrawn')`
        ))
        .orderBy(desc(complaints.likesCount));
    }
    return db
      .select()
      .from(complaints)
      .where(sql`${complaints.status} NOT IN ('draft', 'withdrawn')`)
      .orderBy(desc(complaints.likesCount));
  }

  async getUserComplaints(userId: string): Promise<Complaint[]> {
    return db
      .select()
      .from(complaints)
      .where(eq(complaints.userId, userId))
      .orderBy(desc(complaints.createdAt));
  }

  // ===================== NEW METHOD =====================
  async getExploreComplaints(filters: {
    search?: string;
    category?: string;
    severity?: string;
    urgency?: string;
    status?: string;
    collegeId?: string;
    sort?: "recent" | "likes" | "urgency";
  }): Promise<Complaint[]> {
    const conditions: any[] = [];

    // Exclude drafts and withdrawn from public view
    conditions.push(sql`${complaints.status} NOT IN ('draft', 'withdrawn')`);

    if (filters.search) {
      conditions.push(
        or(
          ilike(complaints.originalText, `%${filters.search}%`),
          ilike(complaints.summary, `%${filters.search}%`)
        )
      );
    }
    if (filters.category && filters.category !== "all") {
      conditions.push(eq(complaints.category, filters.category));
    }
    if (filters.severity && filters.severity !== "all") {
      conditions.push(eq(complaints.severity, filters.severity as any));
    }
    if (filters.urgency && filters.urgency !== "all") {
      conditions.push(eq(complaints.urgency, filters.urgency as any));
    }
    if (filters.status && filters.status !== "all") {
      conditions.push(eq(complaints.status, filters.status as any));
    }
    if (filters.collegeId) {
      conditions.push(eq(complaints.collegeId, filters.collegeId));
    }

    let query = db.select().from(complaints).where(and(...conditions));

    switch (filters.sort) {
      case "recent":
        query = query.orderBy(desc(complaints.createdAt));
        break;
      case "likes":
        query = query.orderBy(desc(complaints.likesCount));
        break;
      case "urgency":
        query = query.orderBy(complaints.urgency);
        break;
      default:
        query = query.orderBy(desc(complaints.createdAt));
    }

    return query;
  }

  async getLeaderboardComplaintsByCollege(collegeId: string) {
    return db
      .select()
      .from(complaints)
      .where(eq(complaints.collegeId, collegeId))
      .orderBy(desc(complaints.likesCount));
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
    await db.delete(complaintMessages).where(eq(complaintMessages.complaintId, id));
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
      await db.delete(complaintMessages).where(eq(complaintMessages.complaintId, id));
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
    return result.map((r: any) => ({ emoji: r.emoji, count: Number(r.count) }));
  }

  async getUserReactions(complaintId: string, userId: string): Promise<string[]> {
    const result = await db
      .select({ emoji: reactions.emoji })
      .from(reactions)
      .where(and(eq(reactions.complaintId, complaintId), eq(reactions.userId, userId)));
    return result.map((r: any) => r.emoji);
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

  async getAdminStats(collegeId?: string): Promise<{
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
    if (collegeId) {
      const complaintsFiltered = await db
        .select()
        .from(complaints)
        .where(eq(complaints.collegeId, collegeId));
      const allUsers = await db.select().from(users);
      const allAbuseLogs = await db.select().from(abuseLogs);
      const now = new Date();
      return {
        totalComplaints: complaintsFiltered.length,
        pendingComplaints: complaintsFiltered.filter((c: any) => c.status === "pending").length,
        solvedComplaints: complaintsFiltered.filter((c: any) => c.solved).length,
        urgentCount: complaintsFiltered.filter((c: any) => c.urgency === "urgent").length,
        criticalCount: complaintsFiltered.filter((c: any) => c.urgency === "critical" || c.urgency === "top_priority").length,
        emergencyCount: complaintsFiltered.filter((c: any) => c.urgency === "emergency").length,
        totalUsers: allUsers.length,
        bannedUsers: allUsers.filter((u: any) => u.bannedUntil && new Date(u.bannedUntil) > now).length,
        abuseLogs: allAbuseLogs.length,
      };
    }
    const allComplaints = await db.select().from(complaints);
    const allUsers = await db.select().from(users);
    const allAbuseLogs = await db.select().from(abuseLogs);
    const now = new Date();
    return {
      totalComplaints: allComplaints.length,
      pendingComplaints: allComplaints.filter((c: any) => c.status === "pending").length,
      solvedComplaints: allComplaints.filter((c: any) => c.solved).length,
      urgentCount: allComplaints.filter((c: any) => c.urgency === "urgent").length,
      criticalCount: allComplaints.filter((c: any) => c.urgency === "critical" || c.urgency === "top_priority").length,
      emergencyCount: allComplaints.filter((c: any) => c.urgency === "emergency").length,
      totalUsers: allUsers.length,
      bannedUsers: allUsers.filter((u: any) => u.bannedUntil && new Date(u.bannedUntil) > now).length,
      abuseLogs: allAbuseLogs.length,
    };
  }

  async getCollegeSettings(collegeId: string) {
    const result = await db
      .select()
      .from(collegeSettings)
      .where(eq(collegeSettings.collegeId, collegeId));
    return result[0] ?? null;
  }

  async setCollegeSettings(collegeId: string, data: any) {
    const existing = await this.getCollegeSettings(collegeId);
    if (existing) {
      await db
        .update(collegeSettings)
        .set(data)
        .where(eq(collegeSettings.collegeId, collegeId));
    } else {
      await db.insert(collegeSettings).values({
        collegeId,
        ...data,
      });
    }
  }

  async getComplaintMessages(complaintId: string): Promise<ComplaintMessage[]> {
    return db
      .select()
      .from(complaintMessages)
      .where(eq(complaintMessages.complaintId, complaintId))
      .orderBy(complaintMessages.createdAt);
  }

  async createComplaintMessage(msg: InsertComplaintMessage): Promise<ComplaintMessage> {
    const [created] = await db.insert(complaintMessages).values(msg).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();