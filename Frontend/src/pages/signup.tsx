import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Shield,
  Eye,
  EyeOff,
  MessageSquare,
  TrendingUp,
  CheckCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Signup() {
  const { signup } = useAuth();
  const [, setLocation] = useLocation();

  const [role, setRole] = useState("student");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [semester, setSemester] = useState("");
  const [college, setCollege] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      await signup({
        role,
        username,
        name,
        email,
        phone,
        rollNumber,
        semester: semester ? Number(semester) : undefined,
        college,
        password,
      });

      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* LEFT SIDE */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary/5 p-12 flex-col justify-center">
        <div className="max-w-md mx-auto space-y-8">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">StudentVoice</span>
          </div>

          <h2 className="text-3xl font-bold leading-tight">
            Verified student grievance platform
          </h2>

          <div className="space-y-4">
            <div className="flex gap-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Verified Accounts</p>
                <p className="text-sm text-muted-foreground">
                  Only real students & faculty allowed
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Track Complaints</p>
                <p className="text-sm text-muted-foreground">
                  Real-time issue tracking
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Institution Linked</p>
                <p className="text-sm text-muted-foreground">
                  Connected with your college
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE FORM */}

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">

        <div className="w-full max-w-md space-y-6">

          <Card>

            <CardHeader className="text-center">
              <CardTitle>Create Account</CardTitle>
              <CardDescription>
                Register with your college details
              </CardDescription>
            </CardHeader>

            <CardContent>

              {error && (
                <div className="text-red-500 text-sm text-center mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">

                {/* ROLE */}

                <div>
                  <label className="text-sm">Role</label>
                  <select
                    className="w-full border rounded p-2"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                  </select>
                </div>

                <Input
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />

                <Input
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />

                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <Input
                  placeholder="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />

                <Input
                  placeholder="Roll Number"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                />

                <Input
                  placeholder="Semester"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                />

                <Input
                  placeholder="College Name"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                />

                <div className="relative">

                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute right-0 top-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>

                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Sign Up"}
                </Button>

              </form>

              <div className="text-center text-sm mt-4">

                Already have account?

                <Link href="/login">
                  <span className="text-primary cursor-pointer">
                    Login
                  </span>
                </Link>

              </div>

            </CardContent>

          </Card>

        </div>

      </div>

    </div>
  );
}