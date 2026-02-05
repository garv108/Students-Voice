import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { SeverityBadge } from "./severity-badge";
import { UrgencyBadge } from "./urgency-badge";
import { StatusBadge } from "./status-badge";
import { ReactionBar } from "./reaction-bar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser, useClerk } from "@clerk/clerk-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  MoreHorizontal,
  Trash2,
  CheckCircle,
  Pencil,
  Users,
  Clock,
} from "lucide-react";
import type { Complaint } from "@shared/schema";

interface ComplaintCardProps {
  complaint: Complaint & {
    reactions?: { emoji: string; count: number }[];
    userLiked?: boolean;
    userDisliked?: boolean;
    userReactions?: string[];
  };
  onEdit?: (complaint: Complaint) => void;
  showActions?: boolean;
  className?: string;
}

export function ComplaintCard({
  complaint,
  onEdit,
  showActions = true,
  className,
}: ComplaintCardProps) {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isOwner = user?.id === complaint.userId;
  const isAdmin = user?.publicMetadata?.role === "admin" || user?.publicMetadata?.role === "moderator";
  const canDelete = isOwner || isAdmin;
  const canMarkSolved = isAdmin;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/complaints/${complaint.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
      toast({ title: "Complaint deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete complaint", variant: "destructive" });
    },
  });

  const solveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", `/api/complaints/${complaint.id}/solve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/complaints"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
      toast({ title: "Complaint marked as solved" });
    },
    onError: () => {
      toast({ title: "Failed to update complaint", variant: "destructive" });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleMarkSolved = () => {
    solveMutation.mutate();
  };

  const createdAt = complaint.createdAt ? new Date(complaint.createdAt) : new Date();

  return (
    <>
      <Card
        className={cn(
          "hover-elevate transition-all duration-150",
          complaint.solved && "opacity-75",
          className
        )}
        data-testid={`card-complaint-${complaint.id}`}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarFallback className="text-sm">
                {complaint.username?.slice(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="font-medium text-sm truncate"
                  data-testid={`text-username-${complaint.id}`}
                >
                  {complaint.username}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <StatusBadge status={complaint.status} />
                {complaint.similarComplaintsCount > 0 && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Users className="h-3 w-3" />
                    {complaint.similarComplaintsCount} similar
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 flex-shrink-0">
            <UrgencyBadge urgency={complaint.urgency} />
            {showActions && canDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    data-testid={`button-actions-${complaint.id}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isAdmin && onEdit && (
                    <DropdownMenuItem
                      onClick={() => onEdit(complaint)}
                      className="gap-2"
                      data-testid={`button-edit-${complaint.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {canMarkSolved && !complaint.solved && (
                    <DropdownMenuItem
                      onClick={handleMarkSolved}
                      className="gap-2"
                      data-testid={`button-solve-${complaint.id}`}
                    >
                      <CheckCircle className="h-4 w-4" />
                      Mark as Solved
                    </DropdownMenuItem>
                  )}
                  {(isAdmin || onEdit) && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="gap-2 text-destructive"
                    data-testid={`button-delete-${complaint.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          {complaint.summary && (
            <p
              className="text-sm font-medium mb-2"
              data-testid={`text-summary-${complaint.id}`}
            >
              {complaint.summary}
            </p>
          )}
          <p
            className="text-sm text-muted-foreground line-clamp-3"
            data-testid={`text-content-${complaint.id}`}
          >
            {complaint.originalText}
          </p>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {complaint.severity && <SeverityBadge severity={complaint.severity} />}
            {complaint.keywords && complaint.keywords.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {complaint.keywords.slice(0, 3).map((keyword, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
                {complaint.keywords.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{complaint.keywords.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-0">
          <ReactionBar
            complaintId={complaint.id}
            likesCount={complaint.likesCount}
            dislikesCount={complaint.dislikesCount}
            reactions={complaint.reactions || []}
            userLiked={complaint.userLiked}
            userDisliked={complaint.userDisliked}
            userReactions={complaint.userReactions}
          />
        </CardFooter>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Complaint</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this complaint? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
