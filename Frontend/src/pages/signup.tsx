import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "../components/header";
import Footer from "../components/footer";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useAuth } from "../lib/auth";
import { useToast } from "../hooks/use-toast";
import { Shield, UserPlus, Eye, EyeOff, CheckCircle, User, GraduationCap, MailCheck } from "lucide-react";

// Updated signup schema with roll number and user type
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
  userType: z.enum(["student", "faculty"], {
    required_error: "Please select user type",
  }),
  rollNumber: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => {
  // Roll number required only for students
  if (data.userType === "student") {
    return data.rollNumber && data.rollNumber.trim().length > 0;
  }
  return true;
}, {
  message: "Roll number is required for students",
  path: ["rollNumber"],
}).refine((data) => {
  // Validate roll number format only for students
  if (data.userType === "student" && data.rollNumber) {
    const rollNumberRegex = /^(2[2-6])(cs|ce|me|ee)\d{2}$/i;
    return rollNumberRegex.test(data.rollNumber);
  }
  return true;
}, {
  message: "Roll number must be in YYbbNN format (e.g., 22CS05, 24EE12)",
  path: ["rollNumber"],
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function Signup() {
  const { signup } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      userType: "student",
      rollNumber: "",
    },
  });

  const userType = form.watch("userType");

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      await signup(
        data.username, 
        data.email, 
        data.password, 
        data.rollNumber, 
        data.userType
      );
      
      setUserEmail(data.email);
      setShowVerificationMessage(true);
      
      toast({ 
        title: "Account created successfully!",
        description: "Please check your email for verification link.",
        variant: "default"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signup failed";
      toast({ 
        title: "Signup failed",
        description: message,
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });

      if (response.ok) {
        toast({
          title: "Verification email resent",
          description: "Please check your inbox again.",
          variant: "default"
        });
      } else {
        const error = await response.json();
        toast({
          title: "Failed to resend email",
          description: error.message,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Network error",
        description: "Failed to resend verification email",
        variant: "destructive"
      });
    }
  };

  if (showVerificationMessage) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4">
                  <div className="p-3 rounded-lg bg-primary/10 inline-block">
                    <MailCheck className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl">Verify Your Email</CardTitle>
                <CardDescription>
                  One more step to complete your registration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center space-y-3">
                  <p className="text-muted-foreground">
                    We've sent a verification link to:
                  </p>
                  <p className="text-lg font-medium">{userEmail}</p>
                  <p className="text-sm text-muted-foreground">
                    Please check your inbox and click the verification link to activate your account.
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Important:
                  </h4>
                  <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                    <li>• Check your spam folder if you don't see the email</li>
                    <li>• The link expires in 24 hours</li>
                    <li>• You need to verify your email before logging in</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleResendVerification}
                    variant="outline"
                    className="w-full"
                  >
                    Resend Verification Email
                  </Button>
                  <Button
                    onClick={() => setLocation("/login")}
                    className="w-full"
                  >
                    Go to Login
                  </Button>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  <p>
                    Wrong email?{" "}
                    <button
                      onClick={() => setShowVerificationMessage(false)}
                      className="text-primary hover:underline"
                    >
                      Go back
                    </button>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

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
                  "Email verification for security",
                  "One account per student/faculty",
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
                      name="userType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>I am a...</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select user type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="student">
                                <div className="flex items-center gap-2">
                                  <GraduationCap className="h-4 w-4" />
                                  Student
                                </div>
                              </SelectItem>
                              <SelectItem value="faculty">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  Faculty/Staff
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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

                    {userType === "student" && (
                      <FormField
                        control={form.control}
                        name="rollNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Roll Number</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 22CS05, 24EE12"
                                {...field}
                                data-testid="input-rollnumber"
                                onChange={(e) => {
                                  field.onChange(e.target.value.toUpperCase());
                                }}
                              />
                            </FormControl>
                            <FormControl>
                              <p className="text-xs text-muted-foreground mt-1">
                                Format: YYbbNN (Year-Branch-Roll) • Example: 22CS05
                              </p>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

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

                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium text-sm mb-2">Security Notice:</h4>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Email verification is required before login</li>
                        <li>• Roll numbers are unique and cannot be changed</li>
                        <li>• One account per email and roll number</li>
                      </ul>
                    </div>

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
      <Footer />
    </div>
  );
}