import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import type { Complaint } from "@shared/schema";

export default function EditComplaint() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [match, params] = useRoute("/edit-complaint/:id");

  const complaintId = params?.id;

  const { data: complaint, isLoading, error } = useQuery<Complaint>({
    queryKey: ["complaint", complaintId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/complaints/${complaintId}`);
      if (!res.ok) throw new Error("Failed to load complaint");
      return res.json();
    },
    enabled: !!complaintId,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [severity, setSeverity] = useState("medium");
  const [status, setStatus] = useState<"draft" | "pending">("draft");

  useEffect(() => {
    if (complaint) {
      setTitle(complaint.summary || complaint.originalText.slice(0, 80));
      setDescription(complaint.originalText);
      setCategory(complaint.category || "Other");
      setSeverity(complaint.severity || "medium");
      setStatus(complaint.status === "draft" ? "draft" : "pending");
    }
  }, [complaint]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/complaints/${complaintId}`, data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-complaints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({ title: "Complaint updated successfully" });
      setLocation("/my-complaints");
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = (newStatus: "draft" | "pending") => {
    updateMutation.mutate({
      originalText: description,
      category,
      severity,
      status: newStatus,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-8">
          <Card><CardContent className="p-6"><Skeleton className="h-6 w-1/2 mb-4" /><Skeleton className="h-40 w-full" /></CardContent></Card>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Complaint not found</h3>
            <Button className="mt-4" onClick={() => setLocation("/my-complaints")}>Back to My Complaints</Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-2xl font-bold">Edit Complaint Draft</h2>
            <p className="text-muted-foreground">Modify the details of your complaint before submitting.</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  rows={8}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Academics">Academics</SelectItem>
                      <SelectItem value="Facilities">Facilities</SelectItem>
                      <SelectItem value="Administration">Administration</SelectItem>
                      <SelectItem value="Safety">Safety</SelectItem>
                      <SelectItem value="Harassment">Harassment</SelectItem>
                      <SelectItem value="Discrimination">Discrimination</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Severity</label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={() => handleSave("pending")} disabled={updateMutation.isPending}>
                Submit Complaint
              </Button>
              <Button variant="outline" onClick={() => handleSave("draft")} disabled={updateMutation.isPending}>
                Save as Draft
              </Button>
              <Button variant="ghost" onClick={() => setLocation("/my-complaints")}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}