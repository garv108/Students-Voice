import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  Users,
  AlertTriangle,
  Trash2,
  Pencil,
  CheckCircle,
  ShieldAlert,
  UserX,
  Search,
  RefreshCw,
  MessageSquare,
  Flame,
  Siren,
  AlertCircle,
  Clock,
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

export default function Admin() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isAuthorized =
    currentUser?.role === "admin" ||
    currentUser?.role === "moderator";

  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingComplaint, setEditingComplaint] = useState<Complaint | null>(null);
  const [editText, setEditText] = useState("");
  const [editStatus, setEditStatus] = useState<string>("pending");
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const { data, isLoading, refetch } = useQuery<AdminData>({
    queryKey: ["/api/admin/dashboard"],
    enabled: !!currentUser && isAuthorized,
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, text, status }: { id: string; text: string; status: string }) =>
      apiRequest("PUT", `/api/admin/complaints/${id}`, { originalText: text, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      toast({ title: "Complaint updated" });
      setEditingComplaint(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) =>
      apiRequest("DELETE", "/api/admin/complaints/bulk", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      toast({ title: "Deleted successfully" });
      setSelectedComplaints([]);
      setShowBulkDeleteDialog(false);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) =>
      apiRequest("PUT", `/api/admin/users/${userId}/role`, { role }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] }),
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, hours }: { userId: string; hours: number }) =>
      apiRequest("PUT", `/api/admin/users/${userId}/ban`, { hours }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] }),
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (userId: string) =>
      apiRequest("PUT", `/api/admin/users/${userId}/unban`, {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] }),
  });

  if (authLoading) return <div className="p-10 text-center">Loading...</div>;

  if (!currentUser || !isAuthorized) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="flex items-center justify-center h-[60vh]">
          <Card className="p-8 text-center">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p>Access Denied</p>
          </Card>
        </main>
      </div>
    );
  }

  const stats = data?.stats || {
    totalComplaints: 0,
    pendingComplaints: 0,
    solvedComplaints: 0,
    urgentCount: 0,
    criticalCount: 0,
    emergencyCount: 0,
    totalUsers: 0,
    bannedUsers: 0,
    abuseLogs: 0,
  };

  const filteredComplaints =
    data?.complaints?.filter(
      (c) =>
        c.originalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.username.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-2xl">{stats.totalComplaints}</p><p>Total</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-2xl">{stats.urgentCount}</p><p>Urgent</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-2xl">{stats.criticalCount}</p><p>Critical</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-2xl">{stats.bannedUsers}</p><p>Banned</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Complaints</CardTitle>
            <CardDescription>Manage complaints</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-4"
            />
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Urgency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComplaints.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.username}</TableCell>
                      <TableCell>{c.originalText}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell><UrgencyBadge urgency={c.urgency} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}