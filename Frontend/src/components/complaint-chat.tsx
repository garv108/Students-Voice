import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface Message {
  id: string;
  complaintId: string;
  senderId: string;
  message: string;
  createdAt: string;
}

export function ComplaintChat({ complaintId, onClose }: { complaintId: string; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["complaint-messages", complaintId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/complaints/${complaintId}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    refetchInterval: 5_000,   // ✅ auto‑refresh chat every 5 seconds
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      await apiRequest("POST", `/api/complaints/${complaintId}/messages`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaint-messages", complaintId] });
      setNewMessage("");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMutation.mutate(newMessage.trim());
  };

  const isAdmin = user?.role === "admin" || user?.role === "moderator";

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-background border-l shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Complaint Chat</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-muted-foreground text-sm text-center">Loading messages…</p>
          ) : messages && messages.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center">No messages yet. Start the conversation.</p>
          ) : (
            messages?.map((msg) => {
              const isOwn = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                    isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    <div className="text-xs opacity-70 mb-1">
                      {isOwn ? "You" : (isAdmin ? "Admin" : "Student")} · {new Date(msg.createdAt).toLocaleTimeString()}
                    </div>
                    {msg.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t flex gap-2">
        <Input
          placeholder="Type a message…"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button onClick={handleSend} disabled={sendMutation.isPending || !newMessage.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}