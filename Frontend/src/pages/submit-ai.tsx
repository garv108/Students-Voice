import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Loader2, FileEdit, Trash2, Mic, MicOff, RefreshCw, AlertTriangle } from "lucide-react";

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
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice recognition state
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        setInput((prev) => prev + (prev ? " " : "") + transcript);
      }
      setListening(false);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  }, [listening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current && listening) recognitionRef.current.stop();
    };
  }, [listening]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch (e) {}
  }, [messages]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const clearChat = () => {
    setMessages([{ role: "assistant", content: "Hi! I'm here to help you file a complaint. Let's start by describing what happened. Please tell me what the issue is." }]);
    setSufficientInfo(false);
    setDraft(null);
    setEditingDraft(false);
    setRetryMessage(null);
    toast({ title: "Chat cleared" });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMessage = retryMessage || input.trim();
    if (!retryMessage) setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);
    setRetryMessage(null);

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

  const generateDraft = async () => {
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/complaints/ai-draft", { conversation: messages });
      if (!response.ok) throw new Error("Draft generation failed");
      const data = await response.json();
      const draft = data.draft;
      // Edge Case 6: validate draft
      if (!draft || !draft.title || !draft.description) {
        setDraft(null);
        toast({ title: "Draft incomplete", description: "Please provide details manually.", variant: "destructive" });
        setEditingDraft(false);
        return;
      }
      setDraft(draft);
      setEditingDraft(true);
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate draft.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const submitComplaint = async (status: "pending" | "draft") => {
    if (!draft) return;
    setLoading(true); // <-- added to prevent double-click during submission
    try {
      const response = await apiRequest("POST", "/api/complaints", {
        description: draft.description,
        title: draft.title,
        category: draft.category,
        severity: draft.severity,
        status,
      });
      if (!response.ok) {
        const err = await response.json();
        // Handle duplicate (409) specifically
        if (response.status === 409) {
          toast({ title: "Duplicate submission", description: err.message, variant: "destructive" });
          setLoading(false);
          return; // stay on page so user can edit
        }
        throw new Error(err.message || "Submission failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      localStorage.removeItem(STORAGE_KEY);
      if (status === "pending") toast({ title: "Complaint submitted successfully!" });
      else toast({ title: "Draft saved!" });
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Draft review view (same as before, unchanged)
  if (draft && editingDraft) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4 safe-area-top safe-area-bottom">
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
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={() => submitComplaint("pending")} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Submit Complaint
                </Button>
                <Button variant="outline" onClick={() => submitComplaint("draft")} disabled={loading}>
                  Save as Draft
                </Button>
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
            {/* Edge Case 3: Retry button */}
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
              <div className="flex justify-center">
                <Button onClick={generateDraft} disabled={loading} className="gap-2">
                  <FileEdit className="h-4 w-4" /> Generate Draft
                </Button>
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