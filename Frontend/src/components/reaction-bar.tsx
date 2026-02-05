import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThumbsUp, ThumbsDown, Flame, AlertTriangle, CheckCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useUser } from "@clerk/clerk-react";
import { useToast } from "@/hooks/use-toast";

interface ReactionBarProps {
  complaintId: string;
  likesCount: number;
  dislikesCount: number;
  reactions: { emoji: string; count: number }[];
  userLiked?: boolean;
  userDisliked?: boolean;
  userReactions?: string[];
  className?: string;
}

const emojiConfig = {
  thumbsup: { icon: ThumbsUp, label: "Thumbs Up" },
  thumbsdown: { icon: ThumbsDown, label: "Thumbs Down" },
  fire: { icon: Flame, label: "Fire" },
  warning: { icon: AlertTriangle, label: "Warning" },
  check: { icon: CheckCircle, label: "Check" },
};

export function ReactionBar({
  complaintId,
  likesCount,
  dislikesCount,
  reactions,
  userLiked = false,
  userDisliked = false,
  userReactions = [],
  className,
}: ReactionBarProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localLiked, setLocalLiked] = useState(userLiked);
  const [localDisliked, setLocalDisliked] = useState(userDisliked);
  const [localLikesCount, setLocalLikesCount] = useState(likesCount);
  const [localDislikesCount, setLocalDislikesCount] = useState(dislikesCount);
  const [localReactions, setLocalReactions] = useState(userReactions);

  const likeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/complaints/${complaintId}/like`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
    },
  });

  const dislikeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/complaints/${complaintId}/dislike`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
    },
  });

  const reactMutation = useMutation({
    mutationFn: async (emoji: string) => {
      return apiRequest("POST", `/api/complaints/${complaintId}/react`, { emoji });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
    },
  });

  const handleLike = async () => {
    if (!user) {
      toast({ title: "Please log in to react", variant: "destructive" });
      return;
    }
    
    const wasLiked = localLiked;
    const wasDisliked = localDisliked;
    
    setLocalLiked(!wasLiked);
    if (wasDisliked) setLocalDisliked(false);
    setLocalLikesCount((prev) => prev + (wasLiked ? -1 : 1));
    if (wasDisliked) setLocalDislikesCount((prev) => prev - 1);
    
    try {
      await likeMutation.mutateAsync();
    } catch {
      setLocalLiked(wasLiked);
      setLocalDisliked(wasDisliked);
      setLocalLikesCount(likesCount);
      setLocalDislikesCount(dislikesCount);
    }
  };

  const handleDislike = async () => {
    if (!user) {
      toast({ title: "Please log in to react", variant: "destructive" });
      return;
    }
    
    const wasLiked = localLiked;
    const wasDisliked = localDisliked;
    
    setLocalDisliked(!wasDisliked);
    if (wasLiked) setLocalLiked(false);
    setLocalDislikesCount((prev) => prev + (wasDisliked ? -1 : 1));
    if (wasLiked) setLocalLikesCount((prev) => prev - 1);
    
    try {
      await dislikeMutation.mutateAsync();
    } catch {
      setLocalLiked(wasLiked);
      setLocalDisliked(wasDisliked);
      setLocalLikesCount(likesCount);
      setLocalDislikesCount(dislikesCount);
    }
  };

  const handleReact = async (emoji: string) => {
    if (!user) {
      toast({ title: "Please log in to react", variant: "destructive" });
      return;
    }
    
    const hasReaction = localReactions.includes(emoji);
    setLocalReactions((prev) =>
      hasReaction ? prev.filter((e) => e !== emoji) : [...prev, emoji]
    );
    
    try {
      await reactMutation.mutateAsync(emoji);
    } catch {
      setLocalReactions(userReactions);
    }
  };

  const reactionCounts = reactions.reduce((acc, r) => {
    acc[r.emoji] = r.count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLike}
        className={cn(
          "gap-1 h-8 px-2",
          localLiked && "bg-primary/10 text-primary ring-1 ring-primary/30"
        )}
        data-testid={`button-like-${complaintId}`}
      >
        <ThumbsUp className={cn("h-4 w-4", localLiked && "fill-current")} />
        <span className="text-xs">{localLikesCount}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDislike}
        className={cn(
          "gap-1 h-8 px-2",
          localDisliked && "bg-destructive/10 text-destructive ring-1 ring-destructive/30"
        )}
        data-testid={`button-dislike-${complaintId}`}
      >
        <ThumbsDown className={cn("h-4 w-4", localDisliked && "fill-current")} />
        <span className="text-xs">{localDislikesCount}</span>
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      {(["fire", "warning", "check"] as const).map((emoji) => {
        const config = emojiConfig[emoji];
        const Icon = config.icon;
        const count = reactionCounts[emoji] || 0;
        const isActive = localReactions.includes(emoji);

        return (
          <Button
            key={emoji}
            variant="ghost"
            size="sm"
            onClick={() => handleReact(emoji)}
            className={cn(
              "gap-1 h-8 px-2",
              isActive && "bg-accent ring-1 ring-accent-border"
            )}
            data-testid={`button-react-${emoji}-${complaintId}`}
          >
            <Icon className={cn("h-4 w-4", isActive && "fill-current")} />
            {count > 0 && <span className="text-xs">{count}</span>}
          </Button>
        );
      })}
    </div>
  );
}
