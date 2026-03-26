import { createContext, useContext, useEffect, useState } from "react";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface SignupData {

  username: string;
  email: string;
  password: string;

  name?: string;
  phone?: string;
  rollNumber?: string;
  semester?: number;

  college?: string;
  collegeId?: string;

  role?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isBackendReady: boolean;

  login: (username: string, password: string) => Promise<void>;

  signup: (data: SignupData) => Promise<void>;

  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || "";

export function AuthProvider({ children }: { children: React.ReactNode }) {

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackendReady, setIsBackendReady] = useState(false);


  // Wake backend
  useEffect(() => {

    const wakeBackend = async () => {

      try {

        await fetch(`${API_BASE}/api/health`, {
          method: "GET",
          signal: AbortSignal.timeout(90000),
        });

        setIsBackendReady(true);

      } catch {

        setIsBackendReady(true);

      }

    };

    wakeBackend();

  }, []);


  const fetchUser = async () => {

    try {

      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: "include",
      });

      if (res.ok) {

        const data = await res.json();
        setUser(data.user);

      } else {

        setUser(null);

      }

    } catch {

      setUser(null);

    } finally {

      setIsLoading(false);

    }

  };


  useEffect(() => {
    fetchUser();
  }, []);


  // LOGIN

  const login = async (username: string, password: string) => {

    const res = await fetch(`${API_BASE}/api/auth/login`, {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      body: JSON.stringify({
        username,
        password,
      }),

    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Login failed");
    }

    setUser(data.user);

  };


  // SIGNUP (UPDATED)

  const signup = async (data: SignupData) => {

    const res = await fetch(`${API_BASE}/api/auth/signup`, {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      body: JSON.stringify(data),

    });

    const resData = await res.json();

    if (!res.ok) {
      throw new Error(resData.message || "Signup failed");
    }

    setUser(resData.user);

  };


  const logout = async () => {

    await fetch(`${API_BASE}/api/auth/logout`, {

      method: "POST",

      credentials: "include",

    });

    setUser(null);

  };


  return (

    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isBackendReady,
        login,
        signup,
        logout,
      }}
    >

      {children}

    </AuthContext.Provider>

  );

}


export function useAuth() {

  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;

}