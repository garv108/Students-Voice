import { useNetworkStatus } from "@/hooks/use-network";
import { WifiOff } from "lucide-react";

export function NetworkStatus() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />
      You are offline. Some features may not work.
    </div>
  );
}