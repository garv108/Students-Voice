import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Shield, ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, Flame } from "lucide-react";

type Severity = "good" | "average" | "poor" | "bad" | "worst" | "critical";

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

const severityConfig: Record<Severity, { label: string; icon: typeof Shield; className: string }> = {
  good: {
    label: "Good",
    icon: ShieldCheck,
    className: "bg-severity-good/10 text-severity-good border-severity-good/30",
  },
  average: {
    label: "Average",
    icon: Shield,
    className: "bg-severity-average/10 text-severity-average border-severity-average/30",
  },
  poor: {
    label: "Poor",
    icon: ShieldAlert,
    className: "bg-severity-poor/10 text-severity-poor border-severity-poor/30",
  },
  bad: {
    label: "Bad",
    icon: AlertTriangle,
    className: "bg-severity-bad/10 text-severity-bad border-severity-bad/30",
  },
  worst: {
    label: "Worst",
    icon: ShieldX,
    className: "bg-severity-worst/10 text-severity-worst border-severity-worst/30",
  },
  critical: {
    label: "Critical",
    icon: Flame,
    className: "bg-severity-critical/10 text-severity-critical border-severity-critical/30",
  },
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity] || severityConfig.average;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", config.className, className)}
      data-testid={`badge-severity-${severity}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
