import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { useUser } from "@clerk/clerk-react";

import VerifyEmail from "./pages/verify-email";
import SSOCallback from "./pages/sso-callback";

// Pages
import Landing from "./pages/landing";
import Home from "./pages/home";
import Login from "./pages/login";
import Signup from "./pages/signup";
import Submit from "./pages/submit";
import Notes from "./pages/notes";
import Admin from "./pages/admin";
import NotFound from "./pages/not-found";

// Protected Route Component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useUser();
  const [, setLocation] = useLocation();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSignedIn) {
    setLocation("/");
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>

      {/* Intro page as default */}
      <Route path="/" component={Landing} />

      {/* Auth routes */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/sso-callback" component={SSOCallback} />

      {/* Dashboard moved here */}
      <Route path="/dashboard">
        <ProtectedRoute component={Home} />
      </Route>

      {/* Protected routes */}
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