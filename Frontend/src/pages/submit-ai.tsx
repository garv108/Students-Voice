import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send, Loader2, FileEdit, Trash2, Mic, MicOff, RefreshCw, AlertTriangle, Search, ExternalLink
} from "lucide-react";
import type { Complaint } from "@shared/schema";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ComplaintDraft {
  title: string;
  description: string;
  category: string;
  severity: string;
}

const STORAGE_KEY = "ai_complaint_chat_messages";
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const BACKEND_URL = "https://student-complaint-backend.onrender.com";

export default function SubmitAI() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      {
        role: "assistant",
        content:
          "Hi! I'm here to help you file a complaint. Let's start by describing what happened. Please tell me what the issue is.",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sufficientInfo, setSufficientInfo] = useState(false);
  const [draft, setDraft] = useState<ComplaintDraft | null>(null);
  const [editingDraft, setEditingDraft] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [similarIssues, setSimilarIssues] = useState<Complaint[] | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [platformMode, setPlatformMode] = useState<string>("normal");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setListening(true);
      // auto‑stop after 3 seconds of silence
      silenceTimer.current = setTimeout(() => {
        recognition.stop();
      }, 3000);
    };

    recognition.onresult = (event: any) => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        setInput((prev) => prev + (prev ? " " : "") + transcript);
      }
      recognition.stop(); // stop immediately after result
      setListening(false);
    };

    recognition.onerror = (event: any) => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      console.error("Speech recognition error:", event.error);
      setListening(false);
    };

    recognition.onend = () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      if (recognitionRef.current && listening) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      // force‑stop on manual click
      recognitionRef.current.abort();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        toast({ title: "Microphone error", description: "Could not start. Please try again.", variant: "destructive" });
      }
    }
  }, [listening, toast]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch (e) {}
  }, [messages]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, similarIssues]);

  // Fetch platform mode on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/maintenance`)
      .then(res => res.json())
      .then(data => setPlatformMode(data.mode || "normal"))
      .catch(() => {});
  }, []);

  const clearChat = () => {
    setMessages([{ role: "assistant", content: "Hi! I'm here to help you file a complaint. Let's start by describing what happened. Please tell me what the issue is." }]);
    setSufficientInfo(false);
    setDraft(null);
    setEditingDraft(false);
    setRetryMessage(null);
    setSimilarIssues(null);
    setAnonymous(true);
    setIsPublic(true);
    toast({ title: "Chat cleared" });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = retryMessage || input.trim();
    if (!retryMessage) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    setRetryMessage(null);
    setSimilarIssues(null);

    try {
      const response = await apiRequest("POST", "/api/complaints/ai-chat", {
        conversation: messages,
        message: userMessage,
      });
      if (!response.ok) throw new Error("Chat request failed");
      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.sufficientInfo) setSufficientInfo(true);
    } catch (error) {
      toast({ title: "Error", description: "Failed to get AI response. Please try again.", variant: "destructive" });
      setRetryMessage(userMessage);
    } finally {
      setLoading(false);
    }
  };

  const retryLastMessage = () => {
    if (!retryMessage) return;
    handleSendMessage();
  };

  const checkSimilarIssues = async () => {
    setLoading(true);
    try {
      const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
      const res = await apiRequest("GET", `/api/complaints/similar?text=${encodeURIComponent(lastUserMsg)}`);
      if (!res.ok) throw new Error("Failed to fetch similar issues");
      const data = await res.json();
      setSimilarIssues(data);
    } catch (error) {
      toast({ title: "Error", description: "Could not check for similar issues.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateDraft = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/complaints/ai-draft", { conversation: messages });
      if (!response.ok) throw new Error("Draft generation failed");
      const data = await response.json();
      const draft = data.draft;
      if (!draft || !draft.title || !draft.description) {
        setDraft(null);
        toast({ title: "Draft incomplete", description: "Please provide details manually.", variant: "destructive" });
        setEditingDraft(false);
        return;
      }
      setDraft(draft);
      setEditingDraft(true);
      if (draft.category === "Harassment" || draft.category === "Discrimination") {
        setAnonymous(false);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate draft.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const submitComplaint = async (status: "pending" | "draft") => {
    if (!draft) return;
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/complaints", {
        description: draft.description,
        title: draft.title,
        category: draft.category,
        severity: draft.severity,
        status,
        anonymous,
        isPublic,
      });
      if (!response.ok) {
        const err = await response.json();
        if (response.status === 400 && err.warnings !== undefined) {
          toast({
            title: err.warnings >= 3 ? "Account Banned" : "Fake Complaint Detected",
            description: err.message,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        if (response.status === 409) {
          toast({ title: "Duplicate submission", description: err.message, variant: "destructive" });
          setLoading(false);
          return;
        }
        if (response.status === 503) {
          toast({ title: "Platform Locked", description: err.message, variant: "destructive" });
          setLoading(false);
          return;
        }
        throw new Error(err.message || "Submission failed");
      }
      const data = await response.json();
      if (data.maintenance) {
        toast({ title: "Saved as Draft", description: data.message || "Complaint saved as draft during maintenance." });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
        localStorage.removeItem(STORAGE_KEY);
        toast({ title: status === "pending" ? "Complaint submitted successfully!" : "Draft saved!" });
      }
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const canToggleAnonymous = draft
    ? draft.category !== "Harassment" && draft.category !== "Discrimination"
    : true;
  const anonymousForcedOff = draft
    ? (draft.category === "Harassment" || draft.category === "Discrimination")
    : false;

  // Draft review view
  if (draft && editingDraft) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 safe-area-top safe-area-bottom">
          {platformMode !== "normal" && (
            <div className={`mb-4 p-3 rounded-lg border text-sm flex items-start gap-3 ${
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
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-2xl font-bold">Review Your Complaint</h2>
              <p className="text-muted-foreground">You can edit the AI‑generated draft below before submitting.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea rows={8} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <Select value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value })}>
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
                    <Select value={draft.severity} onValueChange={(value) => setDraft({ ...draft, severity: value })}>
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

                <div className="flex items-center gap-3 pt-2">
                  <Checkbox
                    id="anonymous"
                    checked={anonymous}
                    onCheckedChange={(checked) => setAnonymous(checked === true)}
                    disabled={!canToggleAnonymous}
                  />
                  <label htmlFor="anonymous" className="text-sm font-medium cursor-pointer">
                    Submit anonymously
                  </label>
                </div>
                {anonymousForcedOff && (
                  <p className="text-xs text-destructive">
                    Your identity is required for this type of complaint under the POSH Act / UGC regulations.
                  </p>
                )}
                {!anonymousForcedOff && (
                  <p className="text-xs text-muted-foreground">
                    Your name will be hidden from the public feed. College administrators may access it if necessary.
                  </p>
                )}

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
              </div>
              <div className="flex gap-3 pt-4">
                {platformMode !== "seize" && (
                  <>
                    <Button onClick={() => submitComplaint("pending")} disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Submit Complaint
                    </Button>
                    <Button variant="outline" onClick={() => submitComplaint("draft")} disabled={loading}>
                      Save as Draft
                    </Button>
                  </>
                )}
                {platformMode === "seize" && (
                  <Button variant="outline" onClick={() => submitComplaint("draft")} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save as Draft
                  </Button>
                )}
                <Button variant="ghost" onClick={() => { setDraft(null); setEditingDraft(false); setSufficientInfo(false); }}>Discard Draft</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Main chat view
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-2 min-h-0 safe-area-top safe-area-bottom">
        {platformMode !== "normal" && (
          <div className={`mb-2 p-2 rounded-lg border text-sm flex items-start gap-2 ${
            platformMode === "seize"
              ? "bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200"
              : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200"
          }`}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">
                {platformMode === "seize" ? "Platform Locked" : "Maintenance"}
              </span>
              {" — "}
              {platformMode === "seize"
                ? "No new complaints can be submitted."
                : "New complaints will be saved as drafts."}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold">AI‑Assisted Complaint</h1>
            <p className="text-muted-foreground text-sm">Answer a few questions and we'll draft your complaint.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation("/submit")}>Direct Submission</Button>
            <Button variant="ghost" size="icon" title="Clear chat" onClick={clearChat}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        <Card className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-2 rounded-xl ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] px-4 py-2 rounded-xl bg-muted"><Loader2 className="h-4 w-4 animate-spin" /></div>
              </div>
            )}
            {retryMessage && !loading && (
              <div className="flex justify-end px-4">
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={retryLastMessage}>
                  <RefreshCw className="h-3 w-3" /> Retry
                </Button>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t p-3 space-y-3 flex-shrink-0">
            {sufficientInfo && !draft && (
              <div className="space-y-2">
                <div className="flex justify-center gap-2">
                  <Button onClick={generateDraft} disabled={loading} className="gap-2">
                    <FileEdit className="h-4 w-4" /> Generate Draft
                  </Button>
                  {!similarIssues && (
                    <Button variant="outline" onClick={checkSimilarIssues} disabled={loading} className="gap-2">
                      <Search className="h-4 w-4" /> Check Similar Issues
                    </Button>
                  )}
                </div>
                {similarIssues && similarIssues.length > 0 && (
                  <Card className="p-3 bg-muted/30">
                    <p className="text-sm font-medium mb-2">Similar issues found:</p>
                    {similarIssues.map((issue) => (
                      <div key={issue.id} className="flex items-center justify-between py-1 border-b last:border-b-0">
                        <div className="flex-1 text-sm truncate">
                          <span className="font-medium">{issue.summary || issue.originalText.slice(0, 60)}</span>
                          <Badge variant="outline" className="ml-2 text-xs">{issue.status}</Badge>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/complaint/${issue.id}`} target="_blank">
                            <ExternalLink className="h-3 w-3 mr-1" /> View
                          </Link>
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mt-2">
                      If one matches your issue, you can upvote it. Otherwise, continue to create your own.
                    </p>
                  </Card>
                )}
                {similarIssues && similarIssues.length === 0 && (
                  <p className="text-sm text-center text-muted-foreground">No similar issues found. You can proceed.</p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder={listening ? "Listening..." : "Type your answer..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={loading || (sufficientInfo && draft !== null)}
                className="flex-1"
              />
              {SpeechRecognition && (
                <Button
                  variant={listening ? "destructive" : "outline"}
                  size="icon"
                  onClick={toggleListening}
                  disabled={loading}
                  className={`relative ${listening ? "animate-pulse" : ""}`}
                  title={listening ? "Stop listening" : "Speak"}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <Button onClick={handleSendMessage} disabled={loading || !input.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}