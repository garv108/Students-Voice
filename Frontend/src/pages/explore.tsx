import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/header";
import Footer from "@/components/footer";
import { ComplaintCard } from "@/components/complaint-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { Search, X } from "lucide-react";
import type { Complaint } from "@shared/schema";

interface ExploreData {
  complaints: (Complaint & {
    reactions?: { emoji: string; count: number }[];
    userLiked?: boolean;
    userDisliked?: boolean;
    userReactions?: string[];
  })[];
}

const CATEGORIES = [
  "all", "Academics", "Facilities", "Administration", "Safety", "Harassment", "Discrimination", "Other"
];

const SEVERITIES = ["all", "good", "average", "poor", "bad", "worst", "critical"];
const URGENCIES = ["all", "normal", "urgent", "critical", "top_priority", "emergency"];
const STATUSES = ["all", "pending", "in_progress", "solved"];
const SORTS = [
  { value: "recent", label: "Newest first" },
  { value: "likes", label: "Most liked" },
  { value: "urgency", label: "Highest urgency" }
];

export default function Explore() {
  const queryClient = useQueryClient();   // <-- ADDED
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [urgency, setUrgency] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");

  const { data, isLoading, error } = useQuery<ExploreData>({
    queryKey: ["/api/complaints/explore", search, category, severity, urgency, status, sort],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (category !== "all") params.append("category", category);
      if (severity !== "all") params.append("severity", severity);
      if (urgency !== "all") params.append("urgency", urgency);
      if (status !== "all") params.append("status", status);
      if (sort) params.append("sort", sort);
      const res = await apiRequest("GET", `/api/complaints/explore?${params.toString()}`);
      return res.json();
    },
  });

  const complaints = data?.complaints || [];

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setSeverity("all");
    setUrgency("all");
    setStatus("all");
    setSort("recent");
  };

  const hasActiveFilters = search || category !== "all" || severity !== "all" || urgency !== "all" || status !== "all";

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Explore Complaints</h1>
          <p className="text-muted-foreground">Browse all public campus issues</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search complaints…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{c === "all" ? "All Categories" : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map(s => (
                <SelectItem key={s} value={s}>{s === "all" ? "All Severities" : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={urgency} onValueChange={setUrgency}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Urgency" />
            </SelectTrigger>
            <SelectContent>
              {URGENCIES.map(u => (
                <SelectItem key={u} value={u}>{u === "all" ? "All Urgencies" : u}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => (
                <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
              <X className="h-4 w-4" /> Clear
            </Button>
          )}
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-12 text-center">
            <p className="text-destructive">Failed to load complaints.</p>
            <Button onClick={() => queryClient.invalidateQueries()} className="mt-4">Retry</Button>
          </Card>
        ) : complaints.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {complaints.map((complaint) => (
              <ComplaintCard key={complaint.id} complaint={complaint} />
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <h3 className="text-lg font-semibold mb-2">No complaints found</h3>
            <p className="text-muted-foreground">
              {hasActiveFilters ? "Try adjusting your filters." : "Be the first to submit a complaint!"}
            </p>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}