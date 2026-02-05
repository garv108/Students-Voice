// src/pages/admin.tsx - FIXED VERSION
// (Only showing the fixed parts, replace the entire file with this)

import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/header";
import { ComplaintCard } from "@/components/complaint-card";
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
import { useUser } from "@clerk/clerk-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  BarChart3,
  Users,
  AlertTriangle,
  Trash2,
  Pencil,
  CheckCircle,
  Shield,
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

// Define type for Clerk user with publicMetadata
type ClerkUser = {
  id: string;
  username?: string;
  publicMetadata?: {
    role?: string;
  };
};

export default function Admin() {
  const { user: currentUser, isLoaded: authLoading } = useUser() as { user: ClerkUser | null | undefined; isLoaded: boolean };
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingComplaint, setEditingComplaint] = useState<Complaint | null>(null);
  const [editText, setEditText] = useState("");
  const [editStatus, setEditStatus] = useState<string>("pending");
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const userRole = currentUser?.publicMetadata?.role || "";
  const isAuthorized = userRole === "admin" || userRole === "moderator";

  const { data, isLoading, error, refetch } = useQuery<AdminData>({
    queryKey: ["/api/admin/dashboard"],
    enabled: !!currentUser && isAuthorized,
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, text, status }: { id: string; text: string; status: string }) => {
      return apiRequest("PUT", `/api/admin/complaints/${id}`, { originalText: text, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({ title: "Complaint updated successfully" });
      setEditingComplaint(null);
    },
    onError: () => {
      toast({ title: "Failed to update complaint", variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/admin/complaints/bulk", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({ title: `${selectedComplaints.length} complaints deleted` });
      setSelectedComplaints([]);
      setShowBulkDeleteDialog(false);
    },
    onError: () => {
      toast({ title: "Failed to delete complaints", variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("PUT", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      toast({ title: "User role updated" });
    },
    onError: () => {
      toast({ title: "Failed to update user role", variant: "destructive" });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async ({ userId, hours }: { userId: string; hours: number }) => {
      return apiRequest("PUT", `/api/admin/users/${userId}/ban`, { hours });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      toast({ title: "User banned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to ban user", variant: "destructive" });
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("PUT", `/api/admin/users/${userId}/unban`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      toast({ title: "User unbanned" });
    },
    onError: () => {
      toast({ title: "Failed to unban user", variant: "destructive" });
    },
  });

  if (authLoading) {
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
              <p className="text-muted-foreground">
                You don't have permission to access this page.
              </p>
            </CardContent>
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

  const filteredComplaints = data?.complaints?.filter(
    (c) =>
      c.originalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedComplaints.length === filteredComplaints?.length) {
      setSelectedComplaints([]);
    } else {
      setSelectedComplaints(filteredComplaints?.map((c) => c.id) || []);
    }
  };

  const handleSelectComplaint = (id: string) => {
    setSelectedComplaints((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const openEditDialog = (complaint: Complaint) => {
    setEditingComplaint(complaint);
    setEditText(complaint.originalText);
    setEditStatus(complaint.status);
  };

  const handleSaveEdit = () => {
    if (editingComplaint) {
      editMutation.mutate({
        id: editingComplaint.id,
        text: editText,
        status: editStatus,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-page-title">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage complaints, users, and monitor platform health
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total-complaints">
                    {stats.totalComplaints}
                  </p>
                  <p className="text-xs text-muted-foreground">Total</p>
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
                    {stats.urgentCount}
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
                    {stats.criticalCount}
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
                    {stats.emergencyCount}
                  </p>
                  <p className="text-xs text-muted-foreground">Emergency</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-destructive/10">
                  <UserX className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-banned">
                    {stats.bannedUsers}
                  </p>
                  <p className="text-xs text-muted-foreground">Banned</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="complaints" className="space-y-6">
          <TabsList>
            <TabsTrigger value="complaints" className="gap-2" data-testid="tab-complaints">
              <MessageSquare className="h-4 w-4" />
              Complaints
            </TabsTrigger>
            <TabsTrigger value="abuse" className="gap-2" data-testid="tab-abuse">
              <AlertTriangle className="h-4 w-4" />
              Abuse Logs
              {stats.abuseLogs > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {stats.abuseLogs}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="complaints" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Complaint Management</CardTitle>
                    <CardDescription>
                      View, edit, and manage all user complaints
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search complaints..."
                        className="pl-9 w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        data-testid="input-search-complaints"
                      />
                    </div>
                    {selectedComplaints.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteDialog(true)}
                        className="gap-2"
                        data-testid="button-bulk-delete"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete ({selectedComplaints.length})
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={
                                selectedComplaints.length === filteredComplaints?.length &&
                                filteredComplaints?.length > 0
                              }
                              onCheckedChange={handleSelectAll}
                              data-testid="checkbox-select-all"
                            />
                          </TableHead>
                          <TableHead>User</TableHead>
                          <TableHead className="w-1/3">Content</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Urgency</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredComplaints?.map((complaint) => (
                          <TableRow key={complaint.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedComplaints.includes(complaint.id)}
                                onCheckedChange={() => handleSelectComplaint(complaint.id)}
                                data-testid={`checkbox-complaint-${complaint.id}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {complaint.username}
                            </TableCell>
                            <TableCell>
                              <p className="line-clamp-2 text-sm text-muted-foreground">
                                {complaint.originalText}
                              </p>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={complaint.status} />
                            </TableCell>
                            <TableCell>
                              <UrgencyBadge urgency={complaint.urgency} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(complaint.createdAt!), {
                                addSuffix: true,
                              })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(complaint)}
                                  data-testid={`button-edit-${complaint.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!filteredComplaints || filteredComplaints.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No complaints found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="abuse" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Abuse Logs</CardTitle>
                <CardDescription>
                  Review flagged content and manage user violations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : data?.abuseLogs && data.abuseLogs.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Flagged Content</TableHead>
                          <TableHead>Detected Words</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.abuseLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">{log.username}</TableCell>
                            <TableCell>
                              <p className="line-clamp-2 text-sm text-muted-foreground max-w-md">
                                {log.flaggedText}
                              </p>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1 flex-wrap">
                                {log.detectedWords?.map((word, idx) => (
                                  <Badge key={idx} variant="destructive" className="text-xs">
                                    {word}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(log.createdAt!), {
                                addSuffix: true,
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-complaintStatus-solved" />
                    <p>No abuse logs found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage user roles and account status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Username</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead className="w-32">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.users?.map((user) => {
                          const isBanned = user.bannedUntil && new Date(user.bannedUntil) > new Date();
                          return (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">{user.username}</TableCell>
                              <TableCell className="text-muted-foreground">{user.email}</TableCell>
                              <TableCell>
                                <Select
                                  value={user.role}
                                  onValueChange={(role) =>
                                    updateRoleMutation.mutate({ userId: user.id, role })
                                  }
                                  disabled={user.id === currentUser.id}
                                >
                                  <SelectTrigger className="w-32" data-testid={`select-role-${user.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="student">Student</SelectItem>
                                    <SelectItem value="moderator">Moderator</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {isBanned ? (
                                  <Badge variant="destructive" className="gap-1">
                                    <Clock className="h-3 w-3" />
                                    Banned
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-complaintStatus-solved/10 text-complaintStatus-solved">
                                    Active
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(user.createdAt!), {
                                  addSuffix: true,
                                })}
                              </TableCell>
                              <TableCell>
                                {user.id !== currentUser.id && (
                                  isBanned ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => unbanUserMutation.mutate(user.id)}
                                      data-testid={`button-unban-${user.id}`}
                                    >
                                      Unban
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={() => banUserMutation.mutate({ userId: user.id, hours: 48 })}
                                      data-testid={`button-ban-${user.id}`}
                                    >
                                      Ban 48h
                                    </Button>
                                  )
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!editingComplaint} onOpenChange={() => setEditingComplaint(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Complaint</DialogTitle>
            <DialogDescription>
              Make changes to the complaint content, status, and urgency level
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-32"
                data-testid="input-edit-content"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="solved">Solved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Urgency Level</label>
                <Select 
                  value={editingComplaint?.urgency || "normal"} 
                  onValueChange={(urgency) => {
                    if (editingComplaint) {
                      setEditingComplaint({ ...editingComplaint, urgency: urgency as any });
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-edit-urgency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                        Normal
                      </div>
                    </SelectItem>
                    <SelectItem value="urgent">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                        Urgent
                      </div>
                    </SelectItem>
                    <SelectItem value="critical">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        Critical
                      </div>
                    </SelectItem>
                    <SelectItem value="top_priority">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        Top Priority
                      </div>
                    </SelectItem>
                    <SelectItem value="emergency">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-700"></div>
                        Emergency
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editingComplaint && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Complaint Info</label>
                <div className="text-sm space-y-1 bg-muted p-3 rounded-md">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Submitted by:</span>
                    <span className="font-medium">{editingComplaint.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reports:</span>
                    <span className="font-medium">{editingComplaint.similarComplaintsCount + 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current severity:</span>
                    <span className="font-medium capitalize">{editingComplaint.severity}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingComplaint(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editMutation.isPending} data-testid="button-save-edit">
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Complaints</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedComplaints.length} complaint(s)?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedComplaints)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-bulk-delete"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}