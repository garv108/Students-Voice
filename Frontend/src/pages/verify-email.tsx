// Frontend/src/pages/verify-email.tsx
import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Header } from "../components/header";
import Footer from "../components/footer";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import { CheckCircle, XCircle, MailCheck, AlertCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    // Extract token from URL query params
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("token");
    
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided");
      return;
    }

    setToken(token);
    verifyEmail(token);
  }, []);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        const data = await response.json();
        setStatus("success");
        setMessage(data.message || "Email verified successfully!");
        
        toast({
          title: "Email Verified!",
          description: "You can now log in to your account.",
          variant: "default",
        });
      } else {
        const error = await response.json();
        setStatus("error");
        setMessage(error.message || "Verification failed");
        
        toast({
          title: "Verification Failed",
          description: error.message || "Invalid or expired token",
          variant: "destructive",
        });
      }
    } catch (error) {
      setStatus("error");
      setMessage("Network error. Please try again.");
      
      toast({
        title: "Network Error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
    }
  };

  const handleResendVerification = async () => {
    // This would need the user's email - could be stored or asked for
    toast({
      title: "Resend Email",
      description: "Please use the resend option on the signup/login page.",
      variant: "default",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4">
                {status === "loading" && (
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/20 inline-block">
                    <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                )}
                {status === "success" && (
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/20 inline-block">
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                )}
                {status === "error" && (
                  <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/20 inline-block">
                    <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                  </div>
                )}
              </div>
              <CardTitle className="text-2xl">
                {status === "loading" && "Verifying Email..."}
                {status === "success" && "Email Verified!"}
                {status === "error" && "Verification Failed"}
              </CardTitle>
              <CardDescription>
                {status === "loading" && "Please wait while we verify your email"}
                {status === "success" && "Your email has been successfully verified"}
                {status === "error" && "We couldn't verify your email"}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Status Message */}
              <div className="text-center">
                <p className="text-muted-foreground mb-2">{message}</p>
                
                {status === "loading" && (
                  <p className="text-sm text-muted-foreground">
                    This may take a few moments...
                  </p>
                )}
                
                {status === "error" && token && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-mono text-muted-foreground break-all">
                      Token: {token.substring(0, 20)}...
                    </p>
                  </div>
                )}
              </div>

              {/* Help Information */}
              {status === "error" && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Troubleshooting:
                  </h4>
                  <ul className="text-sm text-red-700 dark:text-red-400 space-y-1">
                    <li>• The link may have expired (valid for 24 hours)</li>
                    <li>• You may have already verified your email</li>
                    <li>• Try signing in to see if your account is active</li>
                    <li>• Contact support if the problem persists</li>
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {status === "success" && (
                  <>
                    <Button
                      onClick={() => setLocation("/login")}
                      className="w-full"
                    >
                      Go to Login
                    </Button>
                    <Button
                      onClick={() => setLocation("/")}
                      variant="outline"
                      className="w-full"
                    >
                      Go to Homepage
                    </Button>
                  </>
                )}
                
                {status === "error" && (
                  <>
                    <Button
                      onClick={() => setLocation("/login")}
                      variant="default"
                      className="w-full"
                    >
                      Try Login
                    </Button>
                    <Button
                      onClick={() => setLocation("/signup")}
                      variant="outline"
                      className="w-full"
                    >
                      Sign Up Again
                    </Button>
                    <Button
                      onClick={handleResendVerification}
                      variant="ghost"
                      className="w-full"
                    >
                      Need help? Contact Support
                    </Button>
                  </>
                )}
              </div>

              {/* Additional Info */}
              <div className="text-center text-sm text-muted-foreground">
                <p>
                  Need help?{" "}
                  <Link href="/" className="text-primary hover:underline">
                    Contact Support
                  </Link>
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