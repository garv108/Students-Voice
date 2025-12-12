import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Menu, LogOut, User, Shield, Home, Plus, LayoutDashboard } from "lucide-react";
import { useState } from "react";

export function Header() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Leaderboard", icon: Home },
    { href: "/submit", label: "Submit Problem", icon: Plus, requiresAuth: true },
  ];

  const adminLinks = [
    { href: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
  ];

  const handleLogout = async () => {
    await logout();
  };

  const isAdmin = user?.role === "admin" || user?.role === "moderator";

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg hidden sm:inline" data-testid="text-brand">
                StudentVoice
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                if (link.requiresAuth && !user) return null;
                const isActive = location === link.href;
                return (
                  <Link key={link.href} href={link.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2"
                      data-testid={`link-nav-${link.label.toLowerCase().replace(" ", "-")}`}
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </Button>
                  </Link>
                );
              })}
              {isAdmin &&
                adminLinks.map((link) => {
                  const isActive = location === link.href;
                  return (
                    <Link key={link.href} href={link.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        className="gap-2"
                        data-testid={`link-nav-${link.label.toLowerCase().replace(" ", "-")}`}
                      >
                        <link.icon className="h-4 w-4" />
                        {link.label}
                      </Button>
                    </Link>
                  );
                })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="button-user-menu">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">
                        {user.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">{user.username}</span>
                    {isAdmin && (
                      <Badge variant="secondary" className="text-xs">
                        {user.role}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="gap-2" data-testid="menu-item-profile">
                    <User className="h-4 w-4" />
                    <span>{user.username}</span>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <Link href="/admin">
                        <DropdownMenuItem className="gap-2" data-testid="menu-item-admin">
                          <LayoutDashboard className="h-4 w-4" />
                          <span>Admin Dashboard</span>
                        </DropdownMenuItem>
                      </Link>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="gap-2 text-destructive"
                    data-testid="button-logout"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" data-testid="link-login">
                    Log in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" data-testid="link-signup">
                    Sign up
                  </Button>
                </Link>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t flex flex-col gap-1">
            {navLinks.map((link) => {
              if (link.requiresAuth && !user) return null;
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2"
                    data-testid={`link-mobile-${link.label.toLowerCase().replace(" ", "-")}`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              );
            })}
            {isAdmin &&
              adminLinks.map((link) => {
                const isActive = location === link.href;
                return (
                  <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className="w-full justify-start gap-2"
                      data-testid={`link-mobile-${link.label.toLowerCase().replace(" ", "-")}`}
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </Button>
                  </Link>
                );
              })}
          </nav>
        )}
      </div>
    </header>
  );
}
