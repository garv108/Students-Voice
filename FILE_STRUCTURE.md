# Student Voice - Project File Structure

## Project Overview
A full-stack student feedback/voice application with Express backend and React frontend.

---

## Backend (./Backend)

### Core Files
- **server/index.ts** - Main Express server entry point
- **server/routes.ts** - API route definitions
- **server/db.ts** - Database connection (PostgreSQL + Drizzle)
- **server/storage.ts** - Storage layer for data operations
- **server/emailService.ts** - Email sending service
- **server/verification.ts** - Email verification logic
- **server/profanity.ts** - Profanity filter for content
- **server/gemini.ts** - AI integration (Gemini API)

### Configuration
- **shared/schema.ts** - Database schema definitions
- **drizzle.config.ts** - Drizzle ORM configuration
- **package.json** - Backend dependencies

### Database
- **migrations/** - SQL migration files

---

## Frontend (./Frontend)

### Core Files
- **src/App.tsx** - Main React application component
- **src/main.tsx** - React entry point

### Pages (./src/pages/)
- **home.tsx** - Home/dashboard page
- **login.tsx** - User login
- **signup.tsx** - User registration
- **submit.tsx** - Submit feedback/complaint
- **admin.tsx** - Admin panel
- **notes.tsx** - Notes management
- **verify-email.tsx** - Email verification page
- **landing.tsx** - Landing page

### Components (./src/components/)
- **header.tsx** - Navigation header
- **footer.tsx** - Page footer
- **complaint-card.tsx** - Feedback card display
- **reaction-bar.tsx** - User reactions
- **status-badge.tsx** - Status indicator
- **severity-badge.tsx** - Severity indicator
- **urgency-badge.tsx** - Urgency indicator
- **theme-toggle.tsx** - Dark/light mode toggle

### UI Components (./src/components/ui/)
- shadcn/ui component library (buttons, cards, dialogs, etc.)

### Utilities (./src/lib/)
- **utils.ts** - Utility functions
- **queryClient.ts** - React Query client

### Configuration
- **vite.config.ts** - Vite build configuration
- **tailwind.config.ts** - Tailwind CSS configuration
- **package.json** - Frontend dependencies

---

## Root Files
- **package.json** - Root package configuration
- **set_admin.sql** - Admin setup script
- **README.md** - Project documentation
- **design_guidelines.md** - Design guidelines
