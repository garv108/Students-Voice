import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { ComplaintCard } from "@/components/complaint-card";
import { UrgencyBadge, getUrgencyFromCount } from "@/components/urgency-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { useState } from "react";
import {
  AlertCircle,
  TrendingUp,
  Users,
  Filter,
  Plus,
  MessageSquare,
  Flame,
  AlertTriangle,
  Siren,
} from "lucide-react";
import type { Complaint } from "@shared/schema";

interface LeaderboardData {
  complaints: (Complaint & {
    reactions?: { emoji: string; count: number }[];
    userLiked?: boolean;
    userDisliked?: boolean;
    userReactions?: string[];
  })[];
  stats: {
    total: number;
    urgent: number;
    critical: number;
    emergency: number;
    solved: number;
  };
}

export default function Home() {
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery<LeaderboardData>({
    queryKey: ["/api/leaderboard"],
  });

  const filteredComplaints = data?.complaints?.filter((complaint) => {
    if (urgencyFilter !== "all" && complaint.urgency !== urgencyFilter) {
      return false;
    }
    if (statusFilter !== "all") {
      if (statusFilter === "solved" && !complaint.solved) return false;
      if (statusFilter === "pending" && complaint.status !== "pending") return false;
      if (statusFilter === "in_progress" && complaint.status !== "in_progress")
        return false;
    }
    return true;
  });

  const stats = data?.stats || {
    total: 0,
    urgent: 0,
    critical: 0,
    emergency: 0,
    solved: 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <section className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-page-title">
                Student Problem Leaderboard
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl">
                View the most reported issues on campus. Problems are ranked by the
                number of similar reports from students.
              </p>
            </div>
            <Link href="/submit">
              <Button className="gap-2" data-testid="button-submit-problem">
                <Plus className="h-4 w-4" />
                Submit Problem
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-total">
                      {stats.total}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Problems</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-urgency-urgent/10">
                    <AlertCircle className="h-5 w-5 text-urgency-urgent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-urgent">
                      {stats.urgent}
                    </p>
                    <p className="text-xs text-muted-foreground">Urgent</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-urgency-critical/10">
                    <Flame className="h-5 w-5 text-urgency-critical" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-critical">
                      {stats.critical}
                    </p>
                    <p className="text-xs text-muted-foreground">Critical</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-urgency-emergency/10">
                    <Siren className="h-5 w-5 text-urgency-emergency" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-emergency">
                      {stats.emergency}
                    </p>
                    <p className="text-xs text-muted-foreground">Emergency</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-complaintStatus-solved/10">
                    <TrendingUp className="h-5 w-5 text-complaintStatus-solved" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="stat-solved">
                      {stats.solved}
                    </p>
                    <p className="text-xs text-muted-foreground">Solved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filter by:</span>
            </div>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-40" data-testid="select-urgency-filter">
                <SelectValue placeholder="Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgency</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="top_priority">Top Priority</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="solved">Solved</SelectItem>
              </SelectContent>
            </Select>
            {(urgencyFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setUrgencyFilter("all");
                  setStatusFilter("all");
                }}
                data-testid="button-clear-filters"
              >
                Clear filters
              </Button>
            )}
          </div>
        </section>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load problems</h3>
              <p className="text-muted-foreground">
                Please try refreshing the page or check back later.
              </p>
            </CardContent>
          </Card>
        ) : filteredComplaints && filteredComplaints.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredComplaints.map((complaint) => (
              <ComplaintCard key={complaint.id} complaint={complaint} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No problems yet</h3>
              <p className="text-muted-foreground mb-4">
                {urgencyFilter !== "all" || statusFilter !== "all"
                  ? "No problems match your current filters."
                  : "Be the first to report a campus issue."}
              </p>
              <Link href="/submit">
                <Button data-testid="button-submit-first-problem">
                  Submit a Problem
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
