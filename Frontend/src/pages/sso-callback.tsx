import { SignIn } from "@clerk/clerk-react";
import { Header } from "../components/header";
import Footer from "../components/footer";

export default function SSOCallback() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <SignIn />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}