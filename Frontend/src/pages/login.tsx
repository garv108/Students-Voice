import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Shield, Eye, EyeOff, MessageSquare, TrendingUp, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F0F4F8]">
      {/* Left Sidebar */}
      <div className="hidden lg:flex lg:w-1/2 bg-emerald-50 p-12 flex-col justify-center">
        <div className="max-w-md mx-auto space-y-8">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-emerald-600" />
            <span className="text-2xl font-bold text-slate-900">Student's Voice</span>
          </div>
          <h2 className="text-3xl font-bold leading-tight text-slate-800">
            Your voice matters in shaping a better campus experience.
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-slate-800">Report Issues</p>
                <p className="text-sm text-slate-600">Submit campus problems and get them resolved</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-slate-800">Track Progress</p>
                <p className="text-sm text-slate-600">See real-time updates on reported issues</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-slate-800">Make Change</p>
                <p className="text-sm text-slate-600">Your voice leads to real campus improvements</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2 lg:hidden">
            <Shield className="h-6 w-6 text-emerald-600" />
            <span className="text-xl font-bold text-slate-900">Student's Voice</span>
          </div>

          <Card className="border-slate-200 shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-slate-800">Welcome back</CardTitle>
              <CardDescription className="text-slate-500">Enter your credentials to access your account</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 text-sm text-red-600 text-center bg-red-50 p-2 rounded-md">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="border-slate-200 focus:ring-emerald-500 focus:border-emerald-500 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Login"}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-600">
                Don't have an account?{" "}
                <Link href="/signup">
                  <span className="text-emerald-600 hover:underline cursor-pointer font-medium">Sign up</span>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}