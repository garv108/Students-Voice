import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Circle, Clock, CheckCircle, FileEdit, Archive } from "lucide-react";

type Status = "pending" | "in_progress" | "solved" | "draft" | "withdrawn";

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; icon: typeof Circle; className: string }> = {
  pending: {
    label: "Pending",
    icon: Circle,
    className: "bg-muted text-muted-foreground border-border",
  },
  in_progress: {
    label: "In Progress",
    icon: Clock,
    className: "bg-complaintStatus-in-progress/10 text-complaintStatus-in-progress border-complaintStatus-in-progress/30",
  },
  solved: {
    label: "Solved",
    icon: CheckCircle,
    className: "bg-complaintStatus-solved/10 text-complaintStatus-solved border-complaintStatus-solved/30",
  },
  draft: {
    label: "Draft",
    icon: FileEdit,
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  withdrawn: {
    label: "Withdrawn",
    icon: Archive,
    className: "bg-gray-50 text-gray-400 border-gray-200 line-through",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", config.className, className)}
      data-testid={`badge-status-${status}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}