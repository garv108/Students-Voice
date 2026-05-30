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
  Send, Loader2, FileEdit, Trash2, Mic, MicOff, RefreshCw,
  AlertTriangle, Search, ExternalLink, Bot, ArrowRight, Sparkles
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

// Animated typing dots component
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      <span
        className="w-2 h-2 rounded-full bg-indigo-400 inline-block"
        style={{ animation: "typingBounce 1.2s ease-in-out infinite", animationDelay: "0ms" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-indigo-400 inline-block"
        style={{ animation: "typingBounce 1.2s ease-in-out infinite", animationDelay: "200ms" }}
      />
      <span
        className="w-2 h-2 rounded-full bg-indigo-400 inline-block"
        style={{ animation: "typingBounce 1.2s ease-in-out infinite", animationDelay: "400ms" }}
      />
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Single message bubble
function MessageBubble({ msg, index }: { msg: ChatMessage; index: number }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={`flex gap-3 items-end ${isUser ? "flex-row-reverse" : "flex-row"}`}
      style={{
        animation: "bubbleFadeIn 0.25s ease-out both",
        animationDelay: `${Math.min(index * 30, 150)}ms`,
      }}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0 mb-1 ring-2 ring-indigo-200 dark:ring-indigo-800">
          <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={`relative max-w-[75%] sm:max-w-[65%] px-4 py-3 text-sm leading-relaxed shadow-sm
          ${isUser
            ? "bg-indigo-600 text-white rounded-2xl rounded-br-sm"
            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-sm border border-slate-100 dark:border-slate-700"
          }`}
      >
        {msg.content}
      </div>

      <style>{`
        @keyframes bubbleFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

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
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      silenceTimer.current = setTimeout(() => { recognition.stop(); }, 10000);
    };
    recognition.onresult = (event: any) => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) setInput((prev) => prev + (prev ? " " : "") + transcript);
      recognition.stop();
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
      if (recognitionRef.current && listening) recognitionRef.current.abort();
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.abort();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch {
        toast({ title: "Microphone error", description: "Could not start. Please try again.", variant: "destructive" });
      }
    }
  }, [listening, toast]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch (e) {}
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, similarIssues]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/maintenance`)
      .then(res => res.json())
      .then(data => setPlatformMode(data.mode || "normal"))
      .catch(() => {});
  }, []);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

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
    if (inputRef.current) inputRef.current.style.height = "auto";
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

  const retryLastMessage = () => { if (retryMessage) handleSendMessage(); };

  const checkSimilarIssues = async () => {
    setLoading(true);
    try {
      const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.content || "";
      const res = await apiRequest("GET", `/api/complaints/similar?text=${encodeURIComponent(lastUserMsg)}`);
      if (!res.ok) throw new Error("Failed to fetch similar issues");
      const data = await res.json();
      setSimilarIssues(data);
    } catch {
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
      if (draft.category === "Harassment" || draft.category === "Discrimination") setAnonymous(false);
    } catch {
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
          toast({ title: err.warnings >= 3 ? "Account Banned" : "Fake Complaint Detected", description: err.message, variant: "destructive" });
          setLoading(false); return;
        }
        if (response.status === 409) { toast({ title: "Duplicate submission", description: err.message, variant: "destructive" }); setLoading(false); return; }
        if (response.status === 503) { toast({ title: "Platform Locked", description: err.message, variant: "destructive" }); setLoading(false); return; }
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

  const canToggleAnonymous = draft ? draft.category !== "Harassment" && draft.category !== "Discrimination" : true;
  const anonymousForcedOff = draft ? (draft.category === "Harassment" || draft.category === "Discrimination") : false;

  // ── DRAFT REVIEW VIEW ──────────────────────────────────────────────────────
  if (draft && editingDraft) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 safe-area-top safe-area-bottom">
          {platformMode !== "normal" && (
            <div className={`mb-5 p-4 rounded-xl border text-sm flex items-start gap-3 ${
              platformMode === "seize"
                ? "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200"
                : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200"
            }`}>
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{platformMode === "seize" ? "Platform Locked" : "Maintenance Mode"}</p>
                <p className="text-sm mt-0.5 opacity-80">
                  {platformMode === "seize" ? "No new complaints can be submitted at this time." : "New complaints will be saved as drafts only."}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {/* Header strip */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-indigo-950/20">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Review Your Complaint</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Edit the AI‑generated draft below before submitting.</p>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Title</label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="border-slate-200 dark:border-slate-700 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Description</label>
                <Textarea
                  rows={8}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="border-slate-200 dark:border-slate-700 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Category</label>
                  <Select value={draft.category} onValueChange={(value) => setDraft({ ...draft, category: value })}>
                    <SelectTrigger className="border-slate-200 dark:border-slate-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Academics","Facilities","Administration","Safety","Harassment","Discrimination","Other"].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Severity</label>
                  <Select value={draft.severity} onValueChange={(value) => setDraft({ ...draft, severity: value })}>
                    <SelectTrigger className="border-slate-200 dark:border-slate-700"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[["low","Low"],["medium","Medium"],["high","High"],["critical","Critical"]].map(([v,l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Visibility options */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox id="anonymous" checked={anonymous} onCheckedChange={(c) => setAnonymous(c === true)} disabled={!canToggleAnonymous} className="mt-0.5" />
                  <div>
                    <label htmlFor="anonymous" className="text-sm font-medium cursor-pointer text-slate-700 dark:text-slate-300">Submit anonymously</label>
                    {anonymousForcedOff
                      ? <p className="text-xs text-destructive mt-0.5">Identity required under POSH Act / UGC regulations.</p>
                      : <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your name is hidden from the public feed. Admins may access it if necessary.</p>
                    }
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox id="isPublic" checked={isPublic} onCheckedChange={(c) => setIsPublic(c === true)} className="mt-0.5" />
                  <div>
                    <label htmlFor="isPublic" className="text-sm font-medium cursor-pointer text-slate-700 dark:text-slate-300">Make public</label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isPublic ? "Visible to all students and moderators." : "Only visible to administrators and moderators."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                {platformMode !== "seize" && (
                  <>
                    <Button
                      onClick={() => submitComplaint("pending")}
                      disabled={loading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 flex-1 sm:flex-none"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Submit Complaint
                    </Button>
                    <Button variant="outline" onClick={() => submitComplaint("draft")} disabled={loading} className="gap-2">
                      Save as Draft
                    </Button>
                  </>
                )}
                {platformMode === "seize" && (
                  <Button variant="outline" onClick={() => submitComplaint("draft")} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save as Draft
                  </Button>
                )}
                <Button variant="ghost" onClick={() => { setDraft(null); setEditingDraft(false); setSufficientInfo(false); }} className="text-slate-500">
                  Discard Draft
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── MAIN CHAT VIEW ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto safe-area-top safe-area-bottom" style={{ height: "calc(100vh - 64px)" }}>

        {/* Maintenance banner */}
        {platformMode !== "normal" && (
          <div className={`mx-4 mt-3 px-4 py-2.5 rounded-xl border text-sm flex items-center gap-2.5 flex-shrink-0 ${
            platformMode === "seize"
              ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/50 dark:border-red-800 dark:text-red-300"
              : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300"
          }`}>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold">{platformMode === "seize" ? "Platform Locked — " : "Maintenance — "}</span>
              {platformMode === "seize" ? "No new complaints can be submitted." : "New complaints will be saved as drafts."}
            </span>
          </div>
        )}

        {/* Page title row */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </span>
              AI‑Assisted Complaint
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-9">
              Answer a few questions — we'll draft your complaint.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/submit")}
              className="text-xs border-slate-200 dark:border-slate-700 gap-1 hidden sm:flex"
            >
              Direct Submission <ArrowRight className="h-3 w-3" />
            </Button>
            <button
              title="Clear chat"
              onClick={clearChat}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4 min-h-0">

          {/* Welcome state — only first message shown specially */}
          {messages.length === 1 && messages[0].role === "assistant" && (
            <div className="flex justify-center mt-6 mb-2">
              <div className="text-center max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-200 dark:shadow-indigo-900">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-base">Let's file your complaint</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  I'll ask a few questions to understand the issue, then generate a formal complaint draft for you.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} index={i} />
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-3 items-end">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0 ring-2 ring-indigo-200 dark:ring-indigo-800">
                <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <TypingDots />
              </div>
            </div>
          )}

          {/* Retry button */}
          {retryMessage && !loading && (
            <div className="flex justify-end">
              <button
                onClick={retryLastMessage}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}

          {/* Similar issues panel */}
          {similarIssues && similarIssues.length > 0 && (
            <div className="mx-1 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 p-4">
              <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-3">Similar issues found</p>
              <div className="space-y-2">
                {similarIssues.map((issue) => (
                  <div key={issue.id} className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-slate-100 dark:border-slate-700">
                    <div className="flex-1 min-w-0 mr-2">
                      <span className="text-sm text-slate-700 dark:text-slate-200 truncate block">{issue.summary || issue.originalText.slice(0, 60)}</span>
                      <Badge variant="outline" className="text-xs mt-0.5">{issue.status}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="shrink-0 text-indigo-600 hover:text-indigo-700 text-xs">
                      <Link href={`/complaint/${issue.id}`} target="_blank">
                        <ExternalLink className="h-3 w-3 mr-1" /> View
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                If one matches your issue, you can upvote it instead. Otherwise, continue to create your own.
              </p>
            </div>
          )}
          {similarIssues && similarIssues.length === 0 && (
            <p className="text-sm text-center text-slate-500 dark:text-slate-400 py-2">
              No similar issues found. You're good to proceed.
            </p>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Action buttons row — shown when sufficient info */}
        {sufficientInfo && !draft && (
          <div className="px-4 pt-3 pb-1 flex-shrink-0">
            <div className="flex gap-2 justify-center flex-wrap">
              <Button
                onClick={generateDraft}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm shadow-indigo-200 dark:shadow-indigo-900"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileEdit className="h-4 w-4" />}
                Generate Draft
              </Button>
              {!similarIssues && (
                <Button
                  variant="outline"
                  onClick={checkSimilarIssues}
                  disabled={loading}
                  className="gap-2 border-slate-200 dark:border-slate-700"
                >
                  <Search className="h-4 w-4" />
                  Check Similar Issues
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="px-4 pb-4 pt-2 flex-shrink-0">
          <div className="relative flex items-end gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm px-3 py-2 focus-within:border-indigo-400 dark:focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-100 dark:focus-within:ring-indigo-900 transition-all">
            <textarea
              ref={inputRef}
              rows={1}
              placeholder={listening ? "🎙 Listening…" : "Type your answer…"}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={loading || (sufficientInfo && draft !== null)}
              className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 py-1 max-h-[120px] leading-relaxed"
              style={{ minHeight: "36px" }}
            />

            <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
              {/* Mic button */}
              {SpeechRecognition && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={loading}
                  title={listening ? "Stop listening" : "Speak"}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    listening
                      ? "bg-red-500 text-white shadow-lg shadow-red-200 dark:shadow-red-900 scale-110"
                      : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                  }`}
                  style={listening ? { animation: "micPulse 1.2s ease-in-out infinite" } : {}}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  <style>{`
                    @keyframes micPulse {
                      0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
                      50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
                    }
                  `}</style>
                </button>
              )}

              {/* Send button */}
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white disabled:text-slate-400 flex items-center justify-center transition-all active:scale-95"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-2">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>

      </main>
    </div>
  );
}