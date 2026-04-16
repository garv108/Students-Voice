"use client"

import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import { Shield, CheckCircle, AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/auth"

type Role = "student" | "admin" | "moderator"

interface FormData {
  fullName: string
  email: string
  mobile: string
  semester: string
  branch: string
  branchOther: string
  rollNumber: string
  college: string
  collegeOther: string
  department: string
  password: string
  confirmPassword: string
}

const initialFormData: FormData = {
  fullName: "",
  email: "",
  mobile: "",
  semester: "",
  branch: "",
  branchOther: "",
  rollNumber: "",
  college: "",
  collegeOther: "",
  department: "",
  password: "",
  confirmPassword: "",
}

const trustPoints = [
  {
    icon: "🔒",
    title: "Anonymous submissions",
    description: "Your identity stays hidden unless required by law.",
  },
  {
    icon: "📊",
    title: "Live status tracking",
    description: "Know exactly where your complaint stands.",
  },
  {
    icon: "🏛️",
    title: "College-verified ecosystem",
    description: "Only legitimate students and faculty.",
  },
  {
    icon: "⚡",
    title: "Community votes",
    description: "The most urgent issues rise to the top.",
  },
  {
    icon: "📅",
    title: "10-day demo",
    description: "Try Demo College – complaints auto-clean every 10 days.",
  },
]

const semesters = ["1", "2", "3", "4", "5", "6", "7", "8"]
const branches = [
  "Computer Science (CS)",
  "Electrical (EE)",
  "Civil (CE)",
  "Mechanical (ME)",
  "Other",
]
const colleges = ["UCE Banswara", "Demo College", "+ Request your college"]

const API_BASE = import.meta.env.VITE_API_URL || ""

export default function Signup() {
  const { user, login } = useAuth()
  const [, setLocation] = useLocation()
  const [role, setRole] = useState<Role>("student")
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [loading, setLoading] = useState(false)

  // If user is already logged in but onboarding not completed, pre-fill from Google data
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: user.name || user.username || "",
        email: user.email || "",
      }))
    }
  }, [user])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {}

    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required"
    if (!formData.password || formData.password.length < 4)
      newErrors.password = "Password must be at least 4 characters"
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match"

    if (role === "student") {
      if (!formData.semester) newErrors.semester = "Semester is required"
      if (!formData.branch) newErrors.branch = "Branch is required"
      if (formData.branch === "Other" && !formData.branchOther.trim())
        newErrors.branchOther = "Please specify your branch"
      if (!formData.rollNumber.trim())
        newErrors.rollNumber = "Roll number is required"
      if (!formData.college) newErrors.college = "College is required"
      if (
        formData.college === "+ Request your college" &&
        !formData.collegeOther.trim()
      )
        newErrors.collegeOther = "Please enter your college name"
    } else {
      if (!formData.department.trim())
        newErrors.department = "Department is required"
      if (!formData.college) newErrors.college = "College is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setShowConfirmModal(true)
  }

  const handleConfirm = async () => {
    setShowConfirmModal(false)
    setLoading(true)

    try {
      const payload = {
        role,
        fullName: formData.fullName,
        email: formData.email,
        mobile: formData.mobile,
        semester: formData.semester ? parseInt(formData.semester) : null,
        branch: formData.branch === "Other" ? formData.branchOther : formData.branch,
        rollNumber: formData.rollNumber,
        college: formData.college,
        collegeOther: formData.collegeOther,
        department: formData.department,
        password: formData.password,
      }

      const res = await fetch(`${API_BASE}/api/auth/complete-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || "Registration failed")

      // Update auth context with new user data
      await login(data.user.email, formData.password)
      setToastMessage("Account created successfully! Redirecting to dashboard…")
      setShowToast(true)
      setTimeout(() => {
        setLocation("/dashboard")
      }, 2000)
    } catch (err: any) {
      setToastMessage(err.message)
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = () => {
    window.location.href = `${API_BASE}/api/auth/google`
  }

  return (
    <main className="min-h-screen bg-[#F0F4F8] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 md:p-10">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Shield className="w-8 h-8 text-emerald-600" />
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Student's Voice
              </h1>
            </div>
            <p className="text-lg text-slate-600 mb-2">
              Raise your concerns. Track resolutions. Stay anonymous if you wish.
            </p>
            <p className="text-sm text-slate-500">
              Join a verified community of students and college administration.
            </p>
          </div>

          {/* Trust Points */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {trustPoints.map((point, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="mr-2">{point.icon}</span>
                  <span className="font-medium text-slate-900">{point.title}</span>
                  <span className="text-slate-600"> – {point.description}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Google Sign-In */}
          <div className="text-center mb-8">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="inline-flex items-center justify-center gap-3 border border-slate-300 bg-white text-slate-700 rounded-full px-6 py-2.5 shadow-sm hover:shadow-md transition-all hover:bg-slate-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
            <p className="text-xs text-slate-500 mt-2">
              We use Google only for identity verification. No emails will be sent.
            </p>
          </div>

          {/* Role Selection */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-900 mb-3">I am a …</label>
            <div className="flex flex-wrap gap-2">
              {(["student", "admin", "moderator"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                    role === r
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            {(role === "admin" || role === "moderator") && (
              <p className="text-xs text-slate-500 mt-2">
                Admin/moderator accounts require super-admin approval. You will be notified once approved.
              </p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="Full Name"
                  className={`w-full rounded-xl border ${
                    errors.fullName ? "border-red-500" : "border-slate-200"
                  } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                />
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  readOnly
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mobile <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  placeholder="Mobile (optional)"
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              {role === "student" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Semester <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="semester"
                      value={formData.semester}
                      onChange={handleInputChange}
                      className={`w-full rounded-xl border ${
                        errors.semester ? "border-red-500" : "border-slate-200"
                      } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                    >
                      <option value="">Select Semester</option>
                      {semesters.map((s) => (
                        <option key={s} value={s}>Semester {s}</option>
                      ))}
                    </select>
                    {errors.semester && <p className="text-xs text-red-500 mt-1">{errors.semester}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Branch <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="branch"
                      value={formData.branch}
                      onChange={handleInputChange}
                      className={`w-full rounded-xl border ${
                        errors.branch ? "border-red-500" : "border-slate-200"
                      } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                    >
                      <option value="">Select Branch</option>
                      {branches.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    {errors.branch && <p className="text-xs text-red-500 mt-1">{errors.branch}</p>}
                  </div>

                  {formData.branch === "Other" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Specify Branch <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="branchOther"
                        value={formData.branchOther}
                        onChange={handleInputChange}
                        placeholder="Specify branch"
                        className={`w-full rounded-xl border ${
                          errors.branchOther ? "border-red-500" : "border-slate-200"
                        } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                      />
                      {errors.branchOther && <p className="text-xs text-red-500 mt-1">{errors.branchOther}</p>}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Roll Number / Enrollment Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="rollNumber"
                      value={formData.rollNumber}
                      onChange={handleInputChange}
                      placeholder="Roll Number / Enrollment Number"
                      className={`w-full rounded-xl border ${
                        errors.rollNumber ? "border-red-500" : "border-slate-200"
                      } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                    />
                    {errors.rollNumber && <p className="text-xs text-red-500 mt-1">{errors.rollNumber}</p>}
                  </div>
                </>
              )}

              {(role === "admin" || role === "moderator") && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Department / Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    placeholder="Department / Subject"
                    className={`w-full rounded-xl border ${
                      errors.department ? "border-red-500" : "border-slate-200"
                    } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                  />
                  {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  College <span className="text-red-500">*</span>
                </label>
                <select
                  name="college"
                  value={formData.college}
                  onChange={handleInputChange}
                  className={`w-full rounded-xl border ${
                    errors.college ? "border-red-500" : "border-slate-200"
                  } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                >
                  <option value="">Select College</option>
                  {colleges.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {errors.college && <p className="text-xs text-red-500 mt-1">{errors.college}</p>}
              </div>

              {formData.college === "+ Request your college" && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Enter your college name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="collegeOther"
                    value={formData.collegeOther}
                    onChange={handleInputChange}
                    placeholder="Enter your college name"
                    className={`w-full rounded-xl border ${
                      errors.collegeOther ? "border-red-500" : "border-slate-200"
                    } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    We will review and add it. Meanwhile you can use Demo College.
                  </p>
                  {errors.collegeOther && <p className="text-xs text-red-500 mt-1">{errors.collegeOther}</p>}
                </div>
              )}
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Password (4+ characters)"
                  className={`w-full rounded-xl border ${
                    errors.password ? "border-red-500" : "border-slate-200"
                  } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm Password"
                  className={`w-full rounded-xl border ${
                    errors.confirmPassword ? "border-red-500" : "border-slate-200"
                  } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                />
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>⚠️ No password reset available.</strong> Choose a password you will remember (e.g., first 6 digits of your mobile number). Keep it safe.
              </p>
            </div>

            {/* Admin/Moderator note */}
            {(role === "admin" || role === "moderator") && (
              <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <AlertCircle className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-600">
                  Your request for {role} role will be reviewed by the super admin. You will receive confirmation on this platform.
                </p>
              </div>
            )}

            <div className="flex justify-center md:justify-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto bg-emerald-600 text-white rounded-full px-8 py-3 font-medium shadow-sm hover:shadow-md hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Complete Registration"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-3">Confirm Registration</h2>
            <p className="text-slate-600 mb-6">Please double-check your information. Are you sure everything is correct?</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowConfirmModal(false)} className="border border-slate-300 text-slate-700 rounded-full px-5 py-2 hover:bg-slate-50 transition-all">
                Cancel
              </button>
              <button type="button" onClick={handleConfirm} className="bg-emerald-600 text-white rounded-full px-5 py-2 hover:bg-emerald-700 transition-all">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-emerald-600 text-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3 z-50 animate-in slide-in-from-bottom-5">
          <CheckCircle className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
        
      )}
                {/* Login Link */}
          <div className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <a href="/login" className="text-emerald-600 hover:underline font-medium">
              Login here
            </a>
          </div>

          {/* Footer Links */}
          <div className="mt-4 pt-4 border-t border-slate-200 text-center">
            <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500">
              <a href="#" className="hover:text-emerald-600 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Contact Support</a>
            </div>
          </div>
    </main>
  )
}