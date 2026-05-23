import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { ComplaintChat } from "@/components/complaint-chat";   // NEW
import {
  FileEdit,
  Plus,
  AlertTriangle,
  Archive,
  MessageCircle,   // NEW
} from "lucide-react";
import type { Complaint } from "@shared/schema";

const statusTabs = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "solved", label: "Solved" },
  { value: "withdrawn", label: "Withdrawn" },
];

export default function MyComplaints() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [chatComplaintId, setChatComplaintId] = useState<string | null>(null);   // NEW

  const { data: complaints, isLoading, error } = useQuery<Complaint[]>({
    queryKey: ["/api/my-complaints"],
  });

  const withdrawMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/complaints/${id}/withdraw`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({ title: "Complaint withdrawn" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to withdraw", description: err.message, variant: "destructive" });
    },
  });

  const getFilteredComplaints = (status: string) => {
    if (!complaints) return [];
    if (status === "all") return complaints;
    return complaints.filter((c) => c.status === status);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="secondary">Draft</Badge>;
      case "pending": return <Badge variant="default">Pending</Badge>;
      case "in_progress": return <Badge variant="default">In Progress</Badge>;
      case "solved": return <Badge variant="default" className="bg-green-100 text-green-700">Solved</Badge>;
      case "withdrawn": return <Badge variant="outline" className="text-muted-foreground">Withdrawn</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Complaints</h1>
            <p className="text-muted-foreground">Manage all your raised issues</p>
          </div>
          <Link href="/submit-ai">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Complaint
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4"><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-full" /></Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Failed to load complaints</h3>
            <Button className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
          </Card>
        ) : complaints && complaints.length > 0 ? (
          <Tabs defaultValue="all">
            <TabsList className="mb-6 flex-wrap h-auto gap-1 bg-transparent">
              {statusTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {tab.label}
                  {tab.value !== "all" && (
                    <span className="ml-1 text-xs">
                      ({complaints.filter(c => c.status === tab.value).length})
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {statusTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <div className="space-y-4">
                  {getFilteredComplaints(tab.value).map((complaint) => (
                    <Card key={complaint.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              {complaint.summary || complaint.originalText.slice(0, 80)}
                            </h3>
                            {getStatusBadge(complaint.status)}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {complaint.originalText.slice(0, 200)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(complaint.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {complaint.status === "draft" ? (
                            <Link href="/submit-ai">
                              <Button variant="outline" size="sm" className="gap-1">
                                <FileEdit className="h-4 w-4" /> Edit
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => setChatComplaintId(complaint.id)}
                            >
                              <MessageCircle className="h-4 w-4" /> Chat
                            </Button>
                          )}
                          {complaint.status !== "withdrawn" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive gap-1"
                              onClick={() => withdrawMutation.mutate(complaint.id)}
                              disabled={withdrawMutation.isPending}
                            >
                              <Archive className="h-4 w-4" /> Withdraw
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {getFilteredComplaints(tab.value).length === 0 && (
                    <Card className="p-12 text-center">
                      <p className="text-muted-foreground">No {tab.label.toLowerCase()} complaints yet.</p>
                    </Card>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Card className="p-12 text-center">
            <FileEdit className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No complaints yet</h3>
            <p className="text-muted-foreground mb-4">You haven't submitted any complaints.</p>
            <Link href="/submit-ai">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Create your first complaint
              </Button>
            </Link>
          </Card>
        )}
      </main>
      <Footer />

      {/* Chat Panel */}
      {chatComplaintId && (
        <ComplaintChat
          complaintId={chatComplaintId}
          onClose={() => setChatComplaintId(null)}
        />
      )}
    </div>
  );
}