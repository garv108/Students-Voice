import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";

import {
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface College {
  id: string;
  name: string;
}

export default function Signup() {

  const { signup } = useAuth();
  const [, setLocation] = useLocation();

  const API = import.meta.env.VITE_API_URL;

  const [colleges, setColleges] = useState<College[]>([]);

  const [role, setRole] = useState("student");

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [semester, setSemester] = useState("");
  const [collegeId, setCollegeId] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);


  // load colleges

  useEffect(() => {

    const load = async () => {

      try {

        const res = await fetch(`${API}/api/colleges`, {
          credentials: "include",
        });

        const data = await res.json();

        setColleges(data);

      } catch {
        console.log("college load failed");
      }

    };

    load();

  }, []);


  // submit

  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

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
        collegeId,
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

    <div className="min-h-screen flex items-center justify-center p-6">

      <Card className="w-full max-w-md">

        <CardHeader className="text-center">

          <div className="flex justify-center mb-2">
            <Shield />
          </div>

          <CardTitle>Student's Voice</CardTitle>

          <CardDescription>
            Create verified account
          </CardDescription>

        </CardHeader>

        <CardContent>

          {error && (
            <div className="text-red-500 text-sm mb-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">


            {/* ROLE */}

            <select
              className="w-full border rounded p-2 bg-white text-black"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >

              <option value="student">Student</option>
              <option value="moderator">Moderator</option>
              <option value="college_admin">College Admin</option>

            </select>


            {/* NAME */}

            <Input
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />


            {/* USERNAME */}

            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />


            {/* EMAIL */}

            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />


            {/* PHONE */}

            <Input
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />


            {/* STUDENT ONLY */}

            {role === "student" && (

              <>
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
              </>
            )}


            {/* COLLEGE */}

            <select
              className="w-full border rounded p-2 bg-white text-black"
              value={collegeId}
              onChange={(e) => setCollegeId(e.target.value)}
              required
            >

              <option value="">Select College</option>

              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}

            </select>


            {/* PASSWORD */}

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


            {/* CONFIRM */}

            <Input
              type="password"
              placeholder="Confirm Password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />


            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Creating..." : "Sign Up"}
            </Button>

          </form>


          <div className="text-center mt-3 text-sm">

            Already have account?

            <Link href="/login">
              <span className="text-primary cursor-pointer ml-1">
                Login
              </span>
            </Link>

          </div>

        </CardContent>

      </Card>

    </div>

  );

}