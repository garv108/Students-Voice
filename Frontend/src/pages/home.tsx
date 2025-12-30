import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/header";
import { ComplaintCard } from "../components/complaint-card";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Link } from "wouter";
import { useState } from "react";
import {
  TrendingUp,
  Users,
  AlertTriangle,
  ChevronRight,
  Filter,
  Plus,
  MessageSquare,
  Flame,
  AlertCircle,
  CheckCircle,
  BarChart3,
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

  const totalReports = data?.complaints?.reduce((sum, complaint) => 
    sum + complaint.similarComplaintsCount + 1, 0
  ) || 0;

  const urgencyLevels = ["normal", "urgent", "critical", "top_priority", "emergency"] as const;

  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/5 to-background py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">
                  Live Campus Issues Tracker
                </span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight">
                Student Voice Platform
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
                Report campus concerns and track issues that matter most to the student community. 
                Problems are prioritized by urgency and community reports.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/submit">
                  <Button size="lg" className="gap-2" data-testid="button-submit-problem">
                    Submit a Problem
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Card className="p-6 text-center min-w-[140px]">
                <div className="text-3xl font-bold text-primary" data-testid="stat-total">
                  {stats.total}
                </div>
                <div className="text-sm text-muted-foreground">Active Issues</div>
              </Card>
              <Card className="p-6 text-center min-w-[140px]">
                <div className="text-3xl font-bold text-primary">
                  {totalReports}
                </div>
                <div className="text-sm text-muted-foreground">Total Reports</div>
              </Card>
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-md bg-blue-50">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-md bg-orange-50">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.urgent + stats.critical + stats.emergency}
                  </p>
                  <p className="text-xs text-muted-foreground">Urgent+</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-md bg-red-50">
                  <Flame className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.critical + stats.emergency}
                  </p>
                  <p className="text-xs text-muted-foreground">Critical+</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-md bg-green-50">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.solved}</p>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8 md:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Filter Sidebar */}
            <aside className="lg:w-64 shrink-0">
              <div className="lg:sticky lg:top-24 space-y-6">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Filters
                  </h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Urgency Level
                    </label>
                    <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select urgency" />
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
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Status
                    </label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="solved">Solved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(urgencyFilter !== "all" || statusFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setUrgencyFilter("all");
                        setStatusFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>

                {/* Stats Summary */}
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Active Issues</span>
                      <span className="font-medium">{stats.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Resolved</span>
                      <span className="font-medium text-green-600">{stats.solved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Resolution Rate</span>
                      <span className="font-medium">
                        {stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-semibold">Campus Issues</h2>
                  <p className="text-sm text-muted-foreground">
                    Sorted by urgency and community reports
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {filteredComplaints?.length || 0} issues
                </span>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="p-6">
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
                    </Card>
                  ))}
                </div>
              ) : error ? (
                <Card className="p-12">
                  <CardContent className="flex flex-col items-center justify-center text-center">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Failed to load issues</h3>
                    <p className="text-muted-foreground mb-4 max-w-md">
                      Please try refreshing the page or check back later.
                    </p>
                    <Button onClick={() => window.location.reload()}>
                      Refresh Page
                    </Button>
                  </CardContent>
                </Card>
              ) : filteredComplaints && filteredComplaints.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredComplaints.map((complaint) => (
                    <ComplaintCard key={complaint.id} complaint={complaint} />
                  ))}
                </div>
              ) : (
                <Card className="p-12">
                  <CardContent className="flex flex-col items-center justify-center text-center">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {urgencyFilter !== "all" || statusFilter !== "all"
                        ? "No matching issues"
                        : "No issues yet"}
                    </h3>
                    <p className="text-muted-foreground mb-4 max-w-md">
                      {urgencyFilter !== "all" || statusFilter !== "all"
                        ? "Try adjusting your filters to see more campus issues."
                        : "Be the first to report a campus issue and make a difference!"}
                    </p>
                    <Link href="/submit">
                      <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Submit a Problem
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </main>
          </div>
        </div>
      </section>
    </div>
  );
}