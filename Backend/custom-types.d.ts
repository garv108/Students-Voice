// Declare modules to avoid implicit any errors
declare module "cors";

// We should NOT redeclare express-session module here since @types/express-session exists
// Instead, just augment the SessionData interface

// This line ensures the module exists (no implicit any)
// But we need to augment the existing module, not redeclare it

// Remove the "declare module 'express-session'" line and just do:
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}
