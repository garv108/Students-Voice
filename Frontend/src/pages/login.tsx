import { SignIn } from "@clerk/clerk-react";
import { Header } from "@/components/header";

export default function Login() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <SignIn routing="path" path="/login" />
        </div>
      </main>
    </div>
  );
}