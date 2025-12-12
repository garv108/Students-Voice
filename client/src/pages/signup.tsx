import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserPlus, Eye, EyeOff, CheckCircle } from "lucide-react";

const signupSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be at most 100 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function Signup() {
  const { signup } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      await signup(data.username, data.email, data.password);
      toast({ title: "Account created successfully!" });
      setLocation("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signup failed";
      toast({ title: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-12rem)]">
          <div className="hidden lg:block">
            <div className="max-w-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">StudentVoice</h2>
              </div>
              <h1 className="text-4xl font-bold mb-4">
                Join the community
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Create your account and start making a difference on your campus
                today.
              </p>
              <div className="space-y-3">
                {[
                  "Report campus issues anonymously",
                  "Vote on problems that matter to you",
                  "Track issue resolution progress",
                  "Connect with fellow students",
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 lg:hidden">
                  <div className="p-3 rounded-lg bg-primary/10 inline-block">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Create an account</CardTitle>
                <CardDescription>
                  Get started with StudentVoice today
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Choose a username"
                              {...field}
                              data-testid="input-username"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Enter your email"
                              {...field}
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Create a password"
                                {...field}
                                data-testid="input-password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPassword(!showPassword)}
                                data-testid="button-toggle-password"
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Confirm your password"
                              {...field}
                              data-testid="input-confirm-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full gap-2"
                      disabled={isLoading}
                      data-testid="button-signup"
                    >
                      <UserPlus className="h-4 w-4" />
                      {isLoading ? "Creating account..." : "Create account"}
                    </Button>
                  </form>
                </Form>

                <div className="mt-6 text-center text-sm">
                  <span className="text-muted-foreground">
                    Already have an account?{" "}
                  </span>
                  <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
                    Log in
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
