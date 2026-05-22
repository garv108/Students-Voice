import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth.tsx";
import SubmitAI from "./pages/submit-ai";

// Pages
import Landing from "./pages/landing";
import Home from "./pages/home";
import Login from "./pages/login";
import Signup from "./pages/signup";
import Submit from "./pages/submit";
import Admin from "./pages/admin";
import NotFound from "./pages/not-found";
import VerifyEmail from "./pages/VerifyEmail";

// =============================
// Protected Route (Login Only)
// =============================
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

// =============================
// Admin Route (Role-Based)
// =============================
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role !== "admin" && user.role !== "moderator") {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

// =============================
// Router Component
// =============================
function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/dashboard">
      <Route path="/submit-ai" component={SubmitAI} />
      <ProtectedRoute component={Home} />
      </Route>
      <Route path="/submit">
        <ProtectedRoute component={Submit} />
      </Route>
      <Route path="/admin">
        <AdminRoute component={Admin} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// =============================
// App Component
// =============================
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;



/*
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth.tsx";

// Pages
import Landing from "./pages/landing";
import Home from "./pages/home";
import Login from "./pages/login";
import Signup from "./pages/signup";
import Submit from "./pages/submit";
import Notes from "./pages/notes";
import Admin from "./pages/admin";
import NotFound from "./pages/not-found";
import VerifyEmail from "./pages/VerifyEmail";

// =============================
// Protected Route (Login Only)
// =============================
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

// =============================
// Admin Route (Role-Based)
// =============================
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role !== "admin" && user.role !== "moderator") {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

// =============================
// Router Component
// =============================
function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/dashboard">
        <ProtectedRoute component={Home} />
      </Route>
      <Route path="/submit">
        <ProtectedRoute component={Submit} />
      </Route>
      <Route path="/notes">
        <ProtectedRoute component={Notes} />
      </Route>
      <Route path="/admin">
        <AdminRoute component={Admin} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// =============================
// App Component
// =============================
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
*/