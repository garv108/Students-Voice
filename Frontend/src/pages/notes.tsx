import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../lib/auth";
import { apiRequestJson } from "../lib/queryClient";
import { Header } from "../components/header";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useToast } from "../hooks/use-toast";
import { BookOpen, Download, FileText, IndianRupee, ShoppingCart } from "lucide-react";
import type { NotesCategory, NotesFile, NotesPurchase } from "../../../Backend/shared/schema";

const BRANCHES = ["CS", "Civil", "Mech", "Electrical", "Chemical", "IT"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function NotesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<NotesCategory | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<NotesFile | null>(null);
  const [paymentProof, setPaymentProof] = useState("");

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["notes-categories"],
    queryFn: () => apiRequestJson<NotesCategory[]>("GET", "/api/notes/categories"),
  });

  // Fetch files for selected category
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ["notes-files", selectedCategory?.id],
    queryFn: () => selectedCategory
      ? apiRequestJson<NotesFile[]>("GET", `/api/notes/files/${selectedCategory.id}`)
      : Promise.resolve([]),
    enabled: !!selectedCategory,
  });

  // Fetch user's purchases
  const { data: purchases = [] } = useQuery({
    queryKey: ["notes-purchases"],
    queryFn: () => user ? apiRequestJson<NotesPurchase[]>("GET", "/api/notes/my-purchases") : Promise.resolve([]),
    enabled: !!user,
  });

  // Filter categories based on selected branch and semester
  const filteredCategories = categories.filter(category => {
    if (selectedBranch && category.branch !== selectedBranch) return false;
    if (selectedSemester && category.semester !== parseInt(selectedSemester)) return false;
    return true;
  });

  // Group categories by subject
  const subjectGroups = filteredCategories.reduce((acc, category) => {
    const key = `${category.branch}-${category.semester}-${category.subject}`;
    if (!acc[key]) {
      acc[key] = {
        subject: category.subject,
        branch: category.branch,
        semester: category.semester,
        categories: [],
        fileCount: 0,
        totalPrice: 0,
        isFree: false,
      };
    }
    acc[key].categories.push(category);
    return acc;
  }, {} as Record<string, any>);

  // Calculate file counts and pricing for each subject group
  Object.values(subjectGroups).forEach((group: any) => {
    const allFiles = group.categories.flatMap((cat: NotesCategory) =>
      files.filter((file: NotesFile) => file.categoryId === cat.id)
    );
    group.fileCount = allFiles.length;
    group.totalPrice = allFiles.reduce((sum: number, file: NotesFile) => sum + file.price, 0);
    group.isFree = allFiles.some((file: NotesFile) => file.isFree);
  });

  const purchaseMutation = useMutation({
    mutationFn: (data: { fileId: string; paymentProof: string }) =>
      apiRequestJson("POST", "/api/notes/purchase", data),
    onSuccess: () => {
      toast({
        title: "Purchase initiated",
        description: "Your payment proof has been submitted. Please wait for verification.",
      });
      setShowPaymentModal(false);
      setPaymentProof("");
      queryClient.invalidateQueries({ queryKey: ["notes-purchases"] });
    },
    onError: (error: any) => {
      toast({
        title: "Purchase failed",
        description: error.message || "Failed to process purchase",
        variant: "destructive",
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (fileId: string) =>
      apiRequestJson<{ downloadUrl: string }>("GET", `/api/notes/download/${fileId}`),
    onSuccess: (data) => {
      window.open(data.downloadUrl, '_blank');
      toast({
        title: "Download started",
        description: "Your file is being downloaded.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download failed",
        description: error.message || "Failed to download file",
        variant: "destructive",
      });
    },
  });

  const handlePurchase = (file: NotesFile) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to purchase files.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setShowPaymentModal(true);
  };

  const handleDownload = (file: NotesFile) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to download files.",
        variant: "destructive",
      });
      return;
    }

    if (file.isFree) {
      downloadMutation.mutate(file.id);
      return;
    }

    const purchase = purchases.find(p => p.fileId === file.id && p.paymentStatus === "verified");
    if (purchase) {
      downloadMutation.mutate(file.id);
    } else {
      handlePurchase(file);
    }
  };

  const submitPurchase = () => {
    if (!selectedFile || !paymentProof.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide payment proof.",
        variant: "destructive",
      });
      return;
    }

    purchaseMutation.mutate({
      fileId: selectedFile.id,
      paymentProof: paymentProof.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Filters */}
          <div className="w-64 flex-shrink-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="branch">Branch</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Branches" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Branches</SelectItem>
                      {BRANCHES.map(branch => (
                        <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="semester">Semester</Label>
                  <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Semesters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Semesters</SelectItem>
                      {SEMESTERS.map(sem => (
                        <SelectItem key={sem} value={sem.toString()}>{sem}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="mb-6">
              <h1 className="text-3xl font-bold">EduNotes Marketplace</h1>
              <p className="text-muted-foreground mt-2">
                Access study materials for your branch and semester
              </p>
            </div>

            {categoriesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-3 bg-muted rounded mb-4"></div>
                      <div className="h-8 bg-muted rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.values(subjectGroups).map((group: any) => (
                  <Card key={`${group.branch}-${group.semester}-${group.subject}`} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{group.subject}</span>
                        <Badge variant="outline">
                          {group.branch} Sem {group.semester}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span>{group.fileCount} files available</span>
                        </div>

                        <div className="flex items-center justify-between">
                          {group.isFree ? (
                            <Badge variant="secondary">FREE SAMPLE</Badge>
                          ) : (
                            <div className="flex items-center gap-1">
                              <IndianRupee className="h-4 w-4" />
                              <span className="font-semibold">{group.totalPrice}</span>
                            </div>
                          )}

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedCategory(group.categories[0])}
                              >
                                View Files
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>{group.subject} - Files</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                {filesLoading ? (
                                  <div className="space-y-2">
                                    {[...Array(3)].map((_, i) => (
                                      <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
                                    ))}
                                  </div>
                                ) : (
                                  files.map((file: NotesFile) => {
                                    const purchase = purchases.find(p => p.fileId === file.id);
                                    const isPurchased = purchase?.paymentStatus === "verified";
                                    const isPending = purchase?.paymentStatus === "pending";

                                    return (
                                      <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="flex-1">
                                          <h4 className="font-medium">{file.title}</h4>
                                          {file.description && (
                                            <p className="text-sm text-muted-foreground mt-1">{file.description}</p>
                                          )}
                                          <div className="flex items-center gap-4 mt-2">
                                            {file.isFree ? (
                                              <Badge variant="secondary">Free</Badge>
                                            ) : (
                                              <div className="flex items-center gap-1">
                                                <IndianRupee className="h-3 w-3" />
                                                <span className="text-sm font-medium">{file.price}</span>
                                              </div>
                                            )}
                                            {isPurchased && <Badge variant="default">Purchased</Badge>}
                                            {isPending && <Badge variant="outline">Pending Verification</Badge>}
                                          </div>
                                        </div>
                                        <Button
                                          size="sm"
                                          onClick={() => handleDownload(file)}
                                          disabled={downloadMutation.isPending}
                                          className="ml-4"
                                        >
                                          <Download className="h-4 w-4 mr-2" />
                                          {file.isFree || isPurchased ? "Download" : "Purchase"}
                                        </Button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {Object.keys(subjectGroups).length === 0 && !categoriesLoading && (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No subjects found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters to see available subjects.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Purchase File
            </DialogTitle>
          </DialogHeader>
          {selectedFile && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">{selectedFile.title}</h4>
                <p className="text-sm text-muted-foreground">{selectedFile.description}</p>
                <div className="flex items-center gap-1 mt-2">
                  <IndianRupee className="h-4 w-4" />
                  <span className="font-semibold">{selectedFile.price}</span>
                </div>
              </div>

              <div>
                <Label htmlFor="payment-proof">Payment Proof</Label>
                <Textarea
                  id="payment-proof"
                  placeholder="Paste your payment screenshot URL or transaction details here..."
                  value={paymentProof}
                  onChange={(e) => setPaymentProof(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={submitPurchase}
                  disabled={purchaseMutation.isPending}
                  className="flex-1"
                >
                  {purchaseMutation.isPending ? "Submitting..." : "Submit Purchase"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
