import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "../components/header";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "../components/ui/form";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import {
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

const submitSchema = z.object({
  originalText: z
    .string()
    .min(20, "Problem description must be at least 20 characters")
    .max(2000, "Problem description must be at most 2000 characters"),
});

type SubmitFormData = z.infer<typeof submitSchema>;

const BACKEND_URL = "https://student-complaint-backend.onrender.com";

export default function Submit() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [anonymous, setAnonymous] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [platformMode, setPlatformMode] = useState<string>("normal");

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/maintenance`)
      .then(res => res.json())
      .then(data => setPlatformMode(data.mode || "normal"))
      .catch(() => {});
  }, []);

  const form = useForm<SubmitFormData>({
    resolver: zodResolver(submitSchema),
    defaultValues: {
      originalText: "",
    },
  });

  const watchText = form.watch("originalText");
  const charCount = watchText?.length || 0;

  const submitMutation = useMutation({
    mutationFn: async (data: SubmitFormData) => {
      const response = await apiRequest("POST", "/api/complaints", {
        originalText: data.originalText,
        anonymous,
        isPublic,
      });
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 400 && errorData.warnings !== undefined) {
          throw new Error(errorData.message || "Fake complaint detected");
        }
        if (response.status === 503) {
          throw new Error(errorData.message || "Platform is temporarily locked");
        }
        throw new Error(errorData.message || "Failed to submit complaint");
      }
      const result = await response.json();
      if (result.maintenance) {
        throw new Error(result.message || "Complaint saved as draft during maintenance.");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      toast({ title: "Problem submitted successfully!" });
      setLocation("/");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to submit";
      toast({ title: message, variant: "destructive" });
    },
  });

  const onSubmit = (data: SubmitFormData) => {
    submitMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {platformMode !== "normal" && (
          <div className={`mb-6 p-3 rounded-lg border text-sm flex items-start gap-3 ${
            platformMode === "seize"
              ? "bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
              : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200"
          }`}>
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {platformMode === "seize" ? "Platform Locked" : "Maintenance Mode"}
              </p>
              <p className="text-sm">
                {platformMode === "seize"
                  ? "No new complaints can be submitted at this time."
                  : "New complaints will be saved as drafts only."}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-page-title">
              Submit a Problem
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Describe an issue you've encountered on campus. Be specific and include
              relevant details.
            </p>
          </div>
          <Link href="/submit-ai">
            <Button variant="outline" size="sm" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Assistant
            </Button>
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Problem Details</CardTitle>
                <CardDescription>
                  Provide a clear description of the issue you want to report
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="originalText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the problem in detail. Include what happened, where it occurred, and any other relevant information..."
                              className="min-h-48 resize-y"
                              {...field}
                              data-testid="input-problem-description"
                            />
                          </FormControl>
                          <div className="flex justify-between items-center">
                            <FormMessage />
                            <span
                              className={`text-xs ${
                                charCount > 1800
                                  ? "text-destructive"
                                  : charCount > 1500
                                  ? "text-urgency-urgent"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {charCount}/2000 characters
                            </span>
                          </div>
                          <FormDescription>
                            Your problem will be reviewed and categorized automatically.
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center gap-3 pt-2">
                      <Checkbox
                        id="anonymous"
                        checked={anonymous}
                        onCheckedChange={(checked) => setAnonymous(checked === true)}
                      />
                      <label htmlFor="anonymous" className="text-sm font-medium cursor-pointer">
                        Submit anonymously
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your name will be hidden from the public feed. College administrators may access it if necessary.
                    </p>

                    <div className="flex items-center gap-3 pt-2">
                      <Checkbox
                        id="isPublic"
                        checked={isPublic}
                        onCheckedChange={(checked) => setIsPublic(checked === true)}
                      />
                      <label htmlFor="isPublic" className="text-sm font-medium cursor-pointer">
                        Make public
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isPublic
                        ? "Your complaint will be visible to all students and moderators."
                        : "Your complaint will only be visible to administrators and moderators."}
                    </p>

                    {platformMode !== "seize" && (
                      <Button
                        type="submit"
                        className="w-full gap-2"
                        disabled={submitMutation.isPending}
                        data-testid="button-submit-problem"
                      >
                        <Send className="h-4 w-4" />
                        {submitMutation.isPending ? "Submitting..." : "Submit Problem"}
                      </Button>
                    )}
                    {platformMode === "seize" && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        disabled
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Submissions Disabled
                      </Button>
                    )}
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Submission Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-complaintStatus-solved" />
                    Do's
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-2 pl-6">
                    <li className="list-disc">Be specific about the location</li>
                    <li className="list-disc">Include date and time if relevant</li>
                    <li className="list-disc">Describe the impact on students</li>
                    <li className="list-disc">Suggest possible solutions</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    Don'ts
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-2 pl-6">
                    <li className="list-disc">Use abusive or offensive language</li>
                    <li className="list-disc">Target individuals by name</li>
                    <li className="list-disc">Submit duplicate complaints</li>
                    <li className="list-disc">Include personal contact info</li>
                  </ul>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-urgency-urgent mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      <strong>Warning:</strong> Abusive language will result in a
                      48-hour account suspension.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}