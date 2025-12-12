import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Circle, AlertCircle, AlertTriangle, AlertOctagon, Siren } from "lucide-react";

type Urgency = "normal" | "urgent" | "critical" | "top_priority" | "emergency";

interface UrgencyBadgeProps {
  urgency: Urgency;
  count?: number;
  className?: string;
}

const urgencyConfig: Record<Urgency, { label: string; icon: typeof Circle; className: string; pulse?: boolean }> = {
  normal: {
    label: "Normal",
    icon: Circle,
    className: "bg-muted text-muted-foreground border-border",
  },
  urgent: {
    label: "Urgent",
    icon: AlertCircle,
    className: "bg-urgency-urgent/10 text-urgency-urgent border-urgency-urgent/30",
  },
  critical: {
    label: "Critical",
    icon: AlertTriangle,
    className: "bg-urgency-critical/10 text-urgency-critical border-urgency-critical/30",
  },
  top_priority: {
    label: "Top Priority",
    icon: AlertOctagon,
    className: "bg-urgency-top-priority/10 text-urgency-top-priority border-urgency-top-priority/30",
  },
  emergency: {
    label: "Emergency",
    icon: Siren,
    className: "bg-urgency-emergency/10 text-urgency-emergency border-urgency-emergency/30 animate-pulse-subtle",
    pulse: true,
  },
};

export function UrgencyBadge({ urgency, count, className }: UrgencyBadgeProps) {
  const config = urgencyConfig[urgency] || urgencyConfig.normal;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", config.className, className)}
      data-testid={`badge-urgency-${urgency}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
      {count !== undefined && count > 0 && (
        <span className="ml-1 text-xs opacity-75">({count})</span>
      )}
    </Badge>
  );
}

export function getUrgencyFromCount(count: number): Urgency {
  if (count >= 100) return "emergency";
  if (count >= 50) return "top_priority";
  if (count >= 25) return "critical";
  if (count >= 10) return "urgent";
  return "normal";
}
