import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { UrgencyBadge } from "@/components/urgency-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ComplaintChat } from "@/components/complaint-chat";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Users, AlertTriangle, Trash2, Pencil, CheckCircle, ShieldAlert, UserX,
  Search, RefreshCw, MessageSquare, Flame, Siren, AlertCircle, Clock,
  MessageCircle, Loader2, BarChart3, Sparkles, FileDown
} from "lucide-react";
import type { Complaint, User, AbuseLog } from "@shared/schema";

interface AdminStats {
  totalComplaints: number;
  pendingComplaints: number;
  solvedComplaints: number;
  urgentCount: number;
  criticalCount: number;
  emergencyCount: number;
  totalUsers: number;
  bannedUsers: number;
  abuseLogs: number;
}

interface AdminData {
  stats: AdminStats;
  complaints: Complaint[];
  users: User[];
  abuseLogs: AbuseLog[];
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

const REPORT_TYPES = [
  { key: "ugc-annual", label: "UGC Annual Grievance Report", description: "Under UGC Regulations, 2023" },
  { key: "naac-ssr", label: "NAAC SSR – Criterion 5.1.4", description: "Student Grievance Redressal Mechanism" },
  { key: "icc-annual", label: "ICC Annual Report (POSH)", description: "Sexual Harassment of Women at Workplace Act, 2013" },
  { key: "anti-ragging", label: "Anti‑Ragging Committee Report", description: "UGC Regulations, 2009" },
  { key: "sc-st-cell", label: "SC/ST Cell Grievance Report", description: "UGC Equity Regulations, 2025" },
];

const BACKEND_URL = "https://student-complaint-backend.onrender.com";

export default function Admin() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingComplaint, setEditingComplaint] = useState<Complaint | null>(null);
  const [editText, setEditText] = useState("");
  const [editStatus, setEditStatus] = useState<string>("pending");
  const [editUrgency, setEditUrgency] = useState<string>("normal");
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [chatComplaintId, setChatComplaintId] = useState<string | null>(null);
  const [selectedBanHours, setSelectedBanHours] = useState<Record<string, string>>({});

  // ===== ANALYTICS STATE =====
  const [analytics, setAnalytics] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // ===== REPORT DOWNLOAD STATE =====
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  // ===== PLATFORM MODE STATE =====
  const [platformMode, setPlatformMode] = useState<string>("normal");
  const [dailyQuote, setDailyQuote] = useState<string>("");

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        setLocation("/login");
        return;
      }
      const hasAccess = currentUser.role === "admin" || currentUser.role === "moderator";
      setIsAuthorized(hasAccess);
      if (!hasAccess) console.log("User not authorized for admin panel");
    }
  }, [currentUser, authLoading, setLocation]);

  // Fetch analytics when authorized
  useEffect(() => {
    if (isAuthorized) {
      apiRequest("GET", "/api/admin/analytics")
        .then(res => res.json())
        .then(setAnalytics)
        .catch(() => {});
    }
  }, [isAuthorized]);

  // Fetch current platform mode
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/maintenance`)
      .then(res => res.json())
      .then(data => setPlatformMode(data.mode || "normal"))
      .catch(() => {});
  }, []);

  // Fetch daily quote
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/quote`)
      .then(res => res.json())
      .then(data => setDailyQuote(data.quote || ""))
      .catch(() => {});
  }, []);

  const { data, isLoading, error, refetch } = useQuery<AdminData>({
    queryKey: ["/api/admin/dashboard"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/dashboard");
      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          setIsAuthorized(false);
          throw new Error("Not authorized");
        }
        throw new Error("Failed to fetch admin data");
      }
      return response.json();
    },
    enabled: !!currentUser && (currentUser?.role === "admin" || currentUser?.role === "moderator") && isAuthorized === true,
    retry: false,
    staleTime: 30000,
    refetchInterval: 10_000, // ✅ auto-refresh every 10 seconds
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, text, status, urgency }: { id: string; text: string; status: string; urgency: string }) => {
      return apiRequest("PUT", `/api/admin/complaints/${id}`, { originalText: text, status, urgency });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({ title: "Complaint updated successfully" });
      setEditingComplaint(null);
    },
    onError: (error: any) => toast({ title: "Failed to update complaint", description: error.message, variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await apiRequest("DELETE", "/api/admin/complaints/bulk", { ids });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({ title: `${selectedComplaints.length} complaints deleted` });
      setSelectedComplaints([]);
      setShowBulkDeleteDialog(false);
    },
    onError: (error: any) => toast({ title: "Failed to delete complaints", description: error.message, variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/role`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      toast({ title: "User role updated" });
    },
    onError: (error: any) => toast({ title: "Failed to update user role", description: error.message, variant: "destructive" }),
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, hours }: { userId: string; hours: number }) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/ban`, { hours });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      toast({ title: "User banned successfully" });
    },
    onError: (error: any) => toast({ title: "Failed to ban user", description: error.message, variant: "destructive" }),
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("PUT", `/api/admin/users/${userId}/unban`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      toast({ title: "User unbanned" });
    },
    onError: (error: any) => toast({ title: "Failed to unban user", description: error.message, variant: "destructive" }),
  });

  const downloadReport = async (reportType: string) => {
    setDownloadingReport(reportType);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/reports/${reportType}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Download failed" }));
        throw new Error(err.message || "Download failed");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportType}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: "Report download failed", description: error.message, variant: "destructive" });
    } finally {
      setDownloadingReport(null);
    }
  };

  // Set platform mode (only Garv108 can trigger from UI, backend also validates)
  const setMode = async (mode: string) => {
    try {
      const res = await apiRequest("POST", "/api/admin/maintenance", { mode });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to set mode");
      }
      const data = await res.json();
      setPlatformMode(data.mode);
      toast({ title: `Platform mode set to: ${data.mode}` });
    } catch (error: any) {
      toast({ title: "Failed to set mode", description: error.message, variant: "destructive" });
    }
  };

  if (authLoading || isAuthorized === null) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </main>
      </div>
    );
  }

  if (!currentUser || !isAuthorized) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground mb-4">You don't have permission to access this page.</p>
              <Button onClick={() => setLocation("/")} variant="outline">Go to Home</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error Loading Dashboard</h2>
              <p className="text-muted-foreground mb-4">{error instanceof Error ? error.message : "Failed to load admin data"}</p>
              <Button onClick={() => refetch()} variant="outline" className="gap-2"><RefreshCw className="h-4 w-4" /> Try Again</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const stats = data?.stats || {
    totalComplaints: 0, pendingComplaints: 0, solvedComplaints: 0,
    urgentCount: 0, criticalCount: 0, emergencyCount: 0,
    totalUsers: 0, bannedUsers: 0, abuseLogs: 0,
  };

  const filteredComplaints = data?.complaints?.filter(
    (c) => c.originalText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedComplaints.length === filteredComplaints?.length) setSelectedComplaints([]);
    else setSelectedComplaints(filteredComplaints?.map((c) => c.id) || []);
  };

  const handleSelectComplaint = (id: string) => {
    setSelectedComplaints((prev) => prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]);
  };

  const openEditDialog = (complaint: Complaint) => {
    setEditingComplaint(complaint);
    setEditText(complaint.originalText);
    setEditStatus(complaint.status);
    setEditUrgency(complaint.urgency);
  };

  const handleSaveEdit = () => {
    if (editingComplaint) {
      editMutation.mutate({ id: editingComplaint.id, text: editText, status: editStatus, urgency: editUrgency });
    }
  };

  const generateInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/admin/insights");
      const data = await res.json();
      setInsights(data);
    } catch {
      toast({ title: "Failed to generate insights", variant: "destructive" });
    }
    setInsightsLoading(false);
  };

  const modeBannerClass = platformMode === "seize"
    ? "bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
    : platformMode === "maintenance"
    ? "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200"
    : "";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-2">Welcome back, {currentUser?.username} ({currentUser?.role})</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Platform mode selector – Garv108 only */}
            {currentUser?.username === "Garv108" && (
              <Select value={platformMode} onValueChange={setMode}>
                <SelectTrigger className="w-36 h-9 text-sm">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">🟢 Normal</SelectItem>
                  <SelectItem value="maintenance">🟡 Maintenance</SelectItem>
                  <SelectItem value="seize">🔴 Seize</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>

        {/* Mode banner */}
        {platformMode !== "normal" && (
          <div className={`mb-4 p-3 rounded-lg border text-sm flex items-start gap-3 ${modeBannerClass}`}>
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {platformMode === "seize" ? "Platform Locked" : "Maintenance Mode"}
              </p>
              <p className="text-sm">
                {platformMode === "seize"
                  ? "All new submissions and interactions are temporarily disabled."
                  : "New complaints will be saved as drafts only."}
              </p>
            </div>
          </div>
        )}

        {/* Daily Quote */}
        {dailyQuote && (
          <div className="mb-6 p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 dark:from-blue-950 dark:to-indigo-950 dark:border-blue-900 text-center italic text-sm text-blue-800 dark:text-blue-200">
            {dailyQuote}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (<Skeleton key={i} className="h-24 w-full" />))}
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
              <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-md bg-primary/10"><MessageSquare className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{stats.totalComplaints}</p><p className="text-xs text-muted-foreground">Total Complaints</p></div></div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-md bg-urgency-urgent/10"><AlertCircle className="h-5 w-5 text-urgency-urgent" /></div><div><p className="text-2xl font-bold">{stats.urgentCount}</p><p className="text-xs text-muted-foreground">Urgent</p></div></div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-md bg-urgency-critical/10"><Flame className="h-5 w-5 text-urgency-critical" /></div><div><p className="text-2xl font-bold">{stats.criticalCount}</p><p className="text-xs text-muted-foreground">Critical</p></div></div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-md bg-urgency-emergency/10"><Siren className="h-5 w-5 text-urgency-emergency" /></div><div><p className="text-2xl font-bold">{stats.emergencyCount}</p><p className="text-xs text-muted-foreground">Emergency</p></div></div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-md bg-destructive/10"><UserX className="h-5 w-5 text-destructive" /></div><div><p className="text-2xl font-bold">{stats.bannedUsers}</p><p className="text-xs text-muted-foreground">Banned Users</p></div></div></CardContent></Card>
            </div>

            <Tabs defaultValue="complaints" className="space-y-6">
              <TabsList className="overflow-x-auto flex-nowrap">
                <TabsTrigger value="complaints" className="gap-2 shrink-0"><MessageSquare className="h-4 w-4" /> Complaints</TabsTrigger>
                <TabsTrigger value="abuse" className="gap-2 shrink-0"><AlertTriangle className="h-4 w-4" /> Abuse Logs {stats.abuseLogs > 0 && <Badge variant="destructive" className="ml-1">{stats.abuseLogs}</Badge>}</TabsTrigger>
                <TabsTrigger value="users" className="gap-2 shrink-0"><Users className="h-4 w-4" /> Users</TabsTrigger>
                <TabsTrigger value="analytics" className="gap-2 shrink-0"><BarChart3 className="h-4 w-4" /> Analytics</TabsTrigger>
                <TabsTrigger value="reports" className="gap-2 shrink-0"><FileDown className="h-4 w-4" /> Reports</TabsTrigger>
              </TabsList>

              {/* ===== COMPLAINTS TAB ===== */}
              <TabsContent value="complaints" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div><CardTitle>Complaint Management</CardTitle><CardDescription>View, edit, and manage all user complaints</CardDescription></div>
                      <div className="flex items-center gap-3">
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search complaints..." className="pl-9 w-64" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
                        {selectedComplaints.length > 0 && (
                          <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)} className="gap-2" disabled={bulkDeleteMutation.isPending}>
                            {bulkDeleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete ({selectedComplaints.length})
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead className="w-12"><Checkbox checked={selectedComplaints.length === filteredComplaints?.length && filteredComplaints?.length > 0} onCheckedChange={handleSelectAll} /></TableHead><TableHead>User</TableHead><TableHead className="min-w-[200px]">Content</TableHead><TableHead>Status</TableHead><TableHead>Urgency</TableHead><TableHead>Date</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {filteredComplaints?.map((complaint) => (
                            <TableRow key={complaint.id}>
                              <TableCell><Checkbox checked={selectedComplaints.includes(complaint.id)} onCheckedChange={() => handleSelectComplaint(complaint.id)} /></TableCell>
                              <TableCell className="font-medium">{complaint.username}</TableCell>
                              <TableCell className="max-w-xs"><p className="line-clamp-2 text-sm text-muted-foreground">{complaint.originalText}</p></TableCell>
                              <TableCell><StatusBadge status={complaint.status} /></TableCell>
                              <TableCell><UrgencyBadge urgency={complaint.urgency} /></TableCell>
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(complaint.createdAt!), { addSuffix: true })}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(complaint)}><Pencil className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => setChatComplaintId(complaint.id)} title="Chat with student"><MessageCircle className="h-4 w-4" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!filteredComplaints || filteredComplaints.length === 0) && (
                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No complaints found</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ===== ABUSE LOGS TAB ===== */}
              <TabsContent value="abuse" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>Abuse Logs</CardTitle><CardDescription>Review flagged content and manage user violations</CardDescription></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-md border">
                      {data?.abuseLogs && data.abuseLogs.length > 0 ? (
                        <Table>
                          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Flagged Content</TableHead><TableHead>Detected Words</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {data.abuseLogs.map((log) => (
                              <TableRow key={log.id}><TableCell className="font-medium">{log.username}</TableCell><TableCell className="max-w-xs"><p className="line-clamp-2 text-sm text-muted-foreground">{log.flaggedText}</p></TableCell><TableCell><div className="flex gap-1 flex-wrap">{log.detectedWords?.map((word, idx) => <Badge key={idx} variant="destructive" className="text-xs">{word}</Badge>)}</div></TableCell><TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(log.createdAt!), { addSuffix: true })}</TableCell></TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground"><CheckCircle className="h-12 w-12 mx-auto mb-4 text-complaintStatus-solved" /><p>No abuse logs found</p></div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ===== USERS TAB ===== */}
              <TabsContent value="users" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle>User Management</CardTitle><CardDescription>Manage user roles and account status</CardDescription></CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Warnings</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="w-32">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.users?.map((user) => {
                            const isBanned = user.bannedUntil && new Date(user.bannedUntil) > new Date();
                            const warningCount = (user as any).warnings || 0;
                            return (
                              <TableRow key={user.id}>
                                <TableCell className="font-medium">{user.username}</TableCell>
                                <TableCell className="text-muted-foreground max-w-[150px] truncate">{user.email}</TableCell>
                                <TableCell>
                                  <Select value={user.role} onValueChange={(role) => updateRoleMutation.mutate({ userId: user.id, role })} disabled={user.id === currentUser.id || updateRoleMutation.isPending}>
                                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="student">Student</SelectItem><SelectItem value="moderator">Moderator</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  {warningCount > 0 ? (
                                    <Badge variant={warningCount >= 3 ? "destructive" : "secondary"}>
                                      {warningCount} / 3
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">0</span>
                                  )}
                                </TableCell>
                                <TableCell>{isBanned ? <Badge variant="destructive" className="gap-1"><Clock className="h-3 w-3" /> Banned</Badge> : <Badge variant="secondary" className="bg-complaintStatus-solved/10 text-complaintStatus-solved">Active</Badge>}</TableCell>
                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(user.createdAt!), { addSuffix: true })}</TableCell>
                                <TableCell>
                                  {user.id !== currentUser.id && (isBanned ? (
                                    <Button variant="ghost" size="sm" onClick={() => unbanUserMutation.mutate(user.id)} disabled={unbanUserMutation.isPending}>{unbanUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Unban</Button>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <Select value={selectedBanHours?.[user.id] || "48"} onValueChange={(val) => setSelectedBanHours(prev => ({ ...prev, [user.id]: val }))}>
                                        <SelectTrigger className="w-20 h-8 text-xs"><SelectValue placeholder="48h" /></SelectTrigger>
                                        <SelectContent><SelectItem value="24">24h</SelectItem><SelectItem value="48">48h</SelectItem><SelectItem value="168">7 days</SelectItem><SelectItem value="720">30 days</SelectItem></SelectContent>
                                      </Select>
                                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { const hours = parseInt(selectedBanHours?.[user.id] || "48"); banUserMutation.mutate({ userId: user.id, hours }); }} disabled={banUserMutation.isPending}>{banUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Ban</Button>
                                    </div>
                                  ))}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ===== ANALYTICS TAB ===== */}
              <TabsContent value="analytics" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader><CardTitle>Complaints by Month</CardTitle></CardHeader>
                    <CardContent className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics?.byMonth || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <RechartsTooltip />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>By Category</CardTitle></CardHeader>
                    <CardContent className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analytics?.byCategory || []} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                            {analytics?.byCategory?.map((_: any, i: number) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>AI‑Powered Insights</CardTitle>
                      <Button variant="outline" className="gap-2" onClick={generateInsights} disabled={insightsLoading}>
                        {insightsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Generate Insights
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {insights ? (
                      <div className="space-y-6">
                        <div><h4 className="font-medium mb-2">Overall Summary</h4><p className="text-muted-foreground">{insights.summary}</p></div>
                        {insights.patterns?.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Recurring Issues</h4>
                            <div className="space-y-2">
                              {insights.patterns.map((p: any, i: number) => (
                                <div key={i} className="flex items-start gap-3 border rounded-lg p-3">
                                  <Badge variant="secondary">{p.count} reports</Badge>
                                  <div><span className="font-medium">{p.issue}</span><p className="text-sm text-muted-foreground">{p.description}</p></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {insights.spikes?.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Notable Spikes</h4>
                            <div className="space-y-1">
                              {insights.spikes.map((s: any, i: number) => (
                                <p key={i} className="text-sm"><Badge variant="outline" className="mr-2">{s.category}</Badge>{s.note}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">Click "Generate Insights" to analyze recent complaint patterns.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ===== REPORTS TAB ===== */}
              <TabsContent value="reports" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Download Compliance Reports</CardTitle>
                    <CardDescription>
                      Generate and download official PDF reports for regulatory submissions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {REPORT_TYPES.map((report) => (
                        <Card key={report.key} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4 space-y-2">
                            <FileDown className="h-8 w-8 text-primary" />
                            <h3 className="font-semibold text-sm">{report.label}</h3>
                            <p className="text-xs text-muted-foreground">{report.description}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => downloadReport(report.key)}
                              disabled={downloadingReport === report.key}
                            >
                              {downloadingReport === report.key ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <FileDown className="h-4 w-4 mr-2" />
                              )}
                              Download PDF
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingComplaint} onOpenChange={() => setEditingComplaint(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit Complaint</DialogTitle><DialogDescription>Make changes to the complaint content, status, and urgency level</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><label className="text-sm font-medium">Content</label><Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="min-h-32" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Status</label><Select value={editStatus} onValueChange={setEditStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="solved">Solved</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><label className="text-sm font-medium">Urgency Level</label><Select value={editUrgency} onValueChange={setEditUrgency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gray-400"></div> Normal</div></SelectItem><SelectItem value="urgent"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Urgent</div></SelectItem><SelectItem value="critical"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> Critical</div></SelectItem><SelectItem value="top_priority"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Top Priority</div></SelectItem><SelectItem value="emergency"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-700"></div> Emergency</div></SelectItem></SelectContent></Select></div>
            </div>
            {editingComplaint && (<div className="space-y-2"><label className="text-sm font-medium text-muted-foreground">Complaint Info</label><div className="text-sm space-y-1 bg-muted p-3 rounded-md"><div className="flex justify-between"><span className="text-muted-foreground">Submitted by:</span><span className="font-medium">{editingComplaint.username}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Reports:</span><span className="font-medium">{editingComplaint.similarComplaintsCount + 1}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Current severity:</span><span className="font-medium capitalize">{editingComplaint.severity}</span></div></div></div>)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingComplaint(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>{editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Selected Complaints</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete {selectedComplaints.length} complaint(s)? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => bulkDeleteMutation.mutate(selectedComplaints)} className="bg-destructive text-destructive-foreground" disabled={bulkDeleteMutation.isPending}>{bulkDeleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Delete All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Chat Panel */}
      {chatComplaintId && (<ComplaintChat complaintId={chatComplaintId} onClose={() => setChatComplaintId(null)} />)}
    </div>
  );
}