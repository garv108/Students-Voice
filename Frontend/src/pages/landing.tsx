// src/pages/landing.tsx
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, MessageSquare, TrendingUp, Users, CheckCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              StudentVoice Platform
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Your Campus. Your <span className="text-primary">Voice.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Report campus issues, track resolutions, and make your university a better place.
              Join thousands of students making a difference.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="gap-2">
                  <Shield className="h-5 w-5" />
                  Get Started Free
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="gap-2">
                  <Users className="h-5 w-5" />
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card>
                <CardHeader>
                  <MessageSquare className="h-10 w-10 text-primary mb-4" />
                  <CardTitle>Report Issues</CardTitle>
                  <CardDescription>Submit campus problems anonymously or with your identity</CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <TrendingUp className="h-10 w-10 text-primary mb-4" />
                  <CardTitle>Track Progress</CardTitle>
                  <CardDescription>See which issues get attention and get resolved</CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CheckCircle className="h-10 w-10 text-primary mb-4" />
                  <CardTitle>Make Change</CardTitle>
                  <CardDescription>Your voice leads to real campus improvements</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4">
          <Card className="max-w-3xl mx-auto border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Ready to make a difference?</CardTitle>
              <CardDescription>
                Join our community of students improving campus life
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/signup">
                <Button size="lg" className="gap-2">
                  <Shield className="h-5 w-5" />
                  Create Your Account Now
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground mt-4">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in here
                </Link>
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t py-8 px-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} StudentVoice. Empowering student communities.</p>
      </footer>
    </div>
  );
}