import { Switch, Route, Redirect } from "wouter";
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


// =============================
// Protected Route (Login Only)
// =============================
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
    return <Redirect to="/" />;
  }

  return <Component />;
}


// =============================
// Admin Route (Role-Based)
// =============================
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to="/" />;
  }

  const role = user?.publicMetadata?.role;

  if (role !== "admin" && role !== "moderator") {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}


// =============================
// Router
// =============================
function Router() {
  return (
    <Switch>

      {/* Landing / Intro */}
      <Route path="/" component={Landing} />

      {/* Auth Routes */}
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/verify-email" component={VerifyEmail} />

      {/* Clerk OAuth Callbacks */}
      <Route path="/sso-callback" component={SSOCallback} />
      <Route path="/signup/sso-callback" component={SSOCallback} />
      <Route path="/login/sso-callback" component={SSOCallback} />

      {/* Dashboard */}
      <Route path="/dashboard">
        <ProtectedRoute component={Home} />
      </Route>

      {/* Protected Routes */}
      <Route path="/submit">
        <ProtectedRoute component={Submit} />
      </Route>

      <Route path="/notes">
        <ProtectedRoute component={Notes} />
      </Route>

      {/* Admin Only */}
      <Route path="/admin">
        <AdminRoute component={Admin} />
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />

    </Switch>
  );
}


// =============================
// App Wrapper
// =============================
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