import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { useUser } from "@clerk/clerk-react";

// Pages
import Landing from "./pages/landing";
import Home from "./pages/home";
import Login from "./pages/login";
import Signup from "./pages/signup";
import Submit from "./pages/submit";
import Notes from "./pages/notes";
import Admin from "./pages/admin";
import NotFound from "./pages/not-found";
import { Header } from "./components/header";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Link } from "wouter";

// Protected Route Component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Landing />;
  }

  return <Component />;
}

// Public Route Component (for pages everyone can see)
function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/" component={Home} />
      <Route path="/submit">
        <ProtectedRoute component={Submit} />
      </Route>
      <Route path="/notes">
        <ProtectedRoute component={Notes} />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={Admin} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;