"use client"

import { useState } from "react"
import { useLocation, Link } from "wouter"
import { Shield, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react"
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
  const { signup } = useAuth()
  const [, setLocation] = useLocation()
  const [role, setRole] = useState<Role>("student")
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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
    if (!formData.email.trim()) newErrors.email = "Email is required"
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
        // Dummy username (backend will override it)
        username:
          formData.email.split("@")[0] +
          "_" +
          Math.random().toString(36).substring(2, 6),
        email: formData.email,
        password: formData.password,
        name: formData.fullName,
        phone: formData.mobile,
        rollNumber: formData.rollNumber,
        semester: formData.semester ? parseInt(formData.semester) : undefined,
        college: formData.college,
        collegeId: undefined,
        role: role,

        // ✅ Restored missing fields
        branch:
          formData.branch === "Other"
            ? formData.branchOther
            : formData.branch,
        collegeOther:
          formData.college === "+ Request your college"
            ? formData.collegeOther
            : undefined,
        department:
          role === "admin" || role === "moderator"
            ? formData.department
            : undefined,
      }

      await signup(payload)

      // signup() already calls fetchUser() internally, so refreshUser is redundant.
      // Keeping the line would not break anything, but it's unnecessary.
      // await refreshUser();

      setToastMessage(
        "Account created successfully! Redirecting to dashboard…"
      )
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Email address"
                  className={`w-full rounded-xl border ${
                    errors.email ? "border-red-500" : "border-slate-200"
                  } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mobile <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleInputChange}
                  placeholder="Mobile number"
                  className={`w-full rounded-xl border ${
                    errors.mobile ? "border-red-500" : "border-slate-200"
                  } px-4 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                />
                {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile}</p>}
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
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Password (4+ characters)"
                    className={`w-full rounded-xl border ${
                      errors.password ? "border-red-500" : "border-slate-200"
                    } px-4 py-2 pr-10 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm Password"
                    className={`w-full rounded-xl border ${
                      errors.confirmPassword ? "border-red-500" : "border-slate-200"
                    } px-4 py-2 pr-10 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all`}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <strong>⚠️ No password reset available.</strong> Choose a password you will remember. Keep it safe.
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

          <div className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login">
              <span className="text-emerald-600 hover:underline cursor-pointer font-medium">Login here</span>
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 text-center">
            <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-500">
              <a href="#" className="hover:text-emerald-600 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Contact Support</a>
            </div>
          </div>
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
    </main>
  )
}