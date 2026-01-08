export default function Footer() {
  return (
    <footer className="bg-muted/50 border-t py-8 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Made with lots of ❤️ and ☕ by{" "}
            <span 
              className="font-[Sekaiwo] from-black font-semibold"
              style={{
                fontSize: '1.3rem',
                fontWeight: '600',
                letterSpacing: '0.05em',
                textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              Garv Pandya
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            © 2026 All rights reserved
          </p>
        </div>
      </div>
    </footer>
  );
}