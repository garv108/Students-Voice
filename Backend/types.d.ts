// Global type augmentations
declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// Add session to Express Request
declare global {
  namespace Express {
    interface Request {
      session: any;
    }
  }
}
