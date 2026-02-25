# Student's Voice - Production-Ready File Structure

```
students-voice/
│
├── frontend/                          # React + TypeScript Frontend
│   ├── src/
│   │   ├── main.tsx                  # App entry point
│   │   ├── App.tsx                   # Main app with routing & providers
│   │   ├── index.css                 # Global styles
│   │   │
│   │   ├── components/               # Reusable UI components
│   │   │   ├── header.tsx            # Navigation header
│   │   │   ├── footer.tsx            # Page footer
│   │   │   ├── complaint-card.tsx     # Complaint display card
│   │   │   ├── reaction-bar.tsx      # Like/dislike/react buttons
│   │   │   ├── severity-badge.tsx     # Severity indicator
│   │   │   ├── status-badge.tsx      # Status indicator
│   │   │   ├── urgency-badge.tsx     # Urgency indicator
│   │   │   ├── theme-toggle.tsx      # Dark/light mode toggle
│   │   │
│   │   │   └── ui/                   # Shadcn UI components
│   │   │       ├── button.tsx
│   │   │       ├── input.tsx
│   │   │       ├── card.tsx
│   │   │       ├── dialog.tsx
│   │   │       ├── dropdown-menu.tsx
│   │   │       ├── toast.tsx
│   │   │       └── ... (other UI primitives)
│   │   │
│   │   ├── pages/                    # Page components
│   │   │   ├── landing.tsx            # Public landing page
│   │   │   ├── home.tsx              # Student dashboard (leaderboard)
│   │   │   ├── login.tsx             # Login page
│   │   │   ├── signup.tsx            # Registration page
│   │   │   ├── submit.tsx            # Submit complaint page
│   │   │   ├── notes.tsx             # EduNotes marketplace
│   │   │   ├── admin.tsx             # Admin dashboard
│   │   │   └── not-found.tsx         # 404 page
│   │   │
│   │   ├── lib/                     # Core utilities
│   │   │   ├── auth.tsx              # AuthProvider & useAuth hook
│   │   │   ├── queryClient.ts        # React Query client config
│   │   │   └── utils.ts              # Utility functions
│   │   │
│   │   └── hooks/                    # Custom React hooks
│   │       ├── use-mobile.tsx        # Mobile detection
│   │       └── use-toast.ts          # Toast notifications
│   │
│   ├── public/                       # Static assets
│   │   └── favicon.png
│   │
│   ├── index.html                    # HTML template
│   ├── package.json                  # Dependencies
│   ├── vite.config.ts                # Vite configuration
│   ├── tailwind.config.ts            # Tailwind CSS config
│   └── tsconfig.json                 # TypeScript config
│
│
├── backend/                          # Node.js + Express Backend
│   ├── server/
│   │   ├── index.ts                  # Express app setup, middleware, server start
│   │   ├── routes.ts                 # All API route handlers
│   │   ├── storage.ts                # Database storage layer (Drizzle ORM)
│   │   ├── db.ts                     # PostgreSQL connection & table creation
│   │   │
│   │   ├── gemini.ts                 # Gemini AI moderation service
│   │   ├── profanity.ts              # Profanity filter (English + Hindi)
│   │   ├── emailService.ts           # Email sending service
│   │   ├── verification.ts           # Email verification logic
│   │   ├── notes-storage.ts          # Supabase file storage for EduNotes
│   │   └── static.ts                 # Static file serving
│   │
│   ├── shared/
│   │   └── schema.ts                 # Drizzle schema, types & validation
│   │
│   ├── migrations/                   # Database migrations
│   │   └── meta/
│   │
│   ├── script/
│   │   └── build.ts                  # Build script
│   │
│   ├── package.json                  # Dependencies
│   ├── tsconfig.server.json          # TypeScript config
│   ├── drizzle.config.ts             # Drizzle ORM config
│   └── render.yaml                   # Render.com deployment config
│
│
├── set_admin.sql                     # Database setup script
├── package.json                       # Root package.json (workspace)
├── README.md                         # Project documentation
└── design_guidelines.md              # Design system guidelines
```

---

## Structure Explanation

### Frontend (`/frontend`)
| Folder/File | Responsibility |
|-------------|----------------|
| `src/main.tsx` | React app bootstrap |
| `src/App.tsx` | Routing with Wouter, protected routes, role-based access |
| `src/components/` | Reusable UI components (header, cards, badges) |
| `src/components/ui/` | Shadcn UI component library |
| `src/pages/` | Route page components (landing, home, login, admin, etc.) |
| `src/lib/auth.tsx` | AuthContext with session management, login/logout/signup |
| `src/lib/queryClient.ts` | React Query configuration |
| `src/hooks/` | Custom React hooks |

### Backend (`/backend`)
| Folder/File | Responsibility |
|-------------|----------------|
| `server/index.ts` | Express server, CORS, Helmet security, rate limiting, sessions |
| `server/routes.ts` | All API endpoints (auth, complaints, admin, notes) |
| `server/storage.ts` | Database operations (CRUD for users, complaints, reactions) |
| `server/db.ts` | PostgreSQL connection via Drizzle, auto table creation |
| `server/gemini.ts` | Gemini AI for complaint analysis & abuse detection |
| `server/profanity.ts` | Profanity filter (English/Hindi word lists + AI fallback) |
| `server/emailService.ts` | Email verification & notifications |
| `server/verification.ts` | Token-based email verification |
| `server/notes-storage.ts` | Supabase file storage integration |
| `shared/schema.ts` | Database schema, Zod validation, TypeScript types |

---

## Technology Stack

### Frontend
- **React 18** + TypeScript
- **React Query** (data fetching)
- **Wouter** (routing)
- **Tailwind CSS** + Shadcn UI
- **Custom AuthProvider** with session cookies

### Backend
- **Node.js** + Express
- **PostgreSQL** with Drizzle ORM
- **Express Session** (cookie-based auth)
- **Helmet** + Rate Limiting (security)
- **Gemini AI** (complaint analysis)
- **Profanity Filter** (multilingual)

---

## API Endpoints Overview

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Update password

### Complaints
- `GET /api/leaderboard` - Get complaints sorted by engagement
- `POST /api/complaints` - Submit new complaint (with AI moderation)
- `POST /api/complaints/:id/like` - Like a complaint
- `POST /api/complaints/:id/dislike` - Dislike a complaint
- `POST /api/complaints/:id/react` - Add emoji reaction
- `PUT /api/complaints/:id/solve` - Mark as solved (admin)
- `DELETE /api/complaints/:id` - Delete complaint

### Admin
- `GET /api/admin/dashboard` - Dashboard stats & data
- `PUT /api/admin/complaints/:id` - Edit complaint
- `DELETE /api/admin/complaints/bulk` - Bulk delete
- `PUT /api/admin/users/:id/role` - Change user role
- `PUT /api/admin/users/:id/ban` - Ban user
- `PUT /api/admin/users/:id/unban` - Unban user

### EduNotes
- `GET /api/notes/categories` - Browse categories
- `GET /api/notes/files/:categoryId` - List files in category
- `POST /api/notes/purchase` - Purchase file
- `GET /api/notes/download/:fileId` - Download purchased file

---

## Role-Based Access Control

| Role | Permissions |
|------|-------------|
| `student` | Submit complaints, like/react, view leaderboard, purchase notes |
| `moderator` | All student permissions + moderate complaints, verify note purchases |
| `admin` | All permissions + user management, ban/unban, system settings |

---

## Scalability Features

1. **Modular Architecture** - Clear separation between routes, controllers, services
2. **Database Layer** - Drizzle ORM with migrations support
3. **Session-Based Auth** - Scalable authentication with PostgreSQL store
4. **AI Integration** - Gemini API for intelligent content moderation
5. **Clustering** - Similar complaint grouping for urgency calculation
6. **File Storage** - Supabase integration for EduNotes

---

## Excluded (Build/Development Artifacts)
```
✗ node_modules/
✗ dist/
✗ build/
✗ .next/
✗ coverage/
✗ package-lock.json
✗ yarn.lock
✗ tsconfig (boilerplate)
