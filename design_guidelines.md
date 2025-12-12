# Design Guidelines: Student Problem Submission Platform (Enhanced)

## Design Approach
**Selected Approach:** Design System (Utility-Focused)  
**Primary Reference:** Linear + Notion hybrid aesthetic with GitHub-style reactions  
**Justification:** Information-dense platform requiring clear data hierarchy, efficient forms, dashboard-style layouts, and interactive feedback mechanisms.

---

## Typography System

**Font Families:**
- Primary: Inter (Google Fonts) - UI, body text, forms
- Monospace: JetBrains Mono - timestamps, IDs, technical data

**Type Scale:**
- Hero/Page Titles: text-4xl, font-bold
- Section Headers: text-2xl, font-semibold
- Card Titles: text-lg, font-medium
- Body Text: text-base, font-normal
- Labels/Meta: text-sm, font-medium
- Captions/Timestamps: text-xs, font-normal

**Line Heights:** Headlines: leading-tight | Body: leading-relaxed | Forms: leading-normal

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16, 20 (e.g., p-4, m-8, gap-6)

**Grid Structure:**
- Container: max-w-7xl mx-auto
- Page padding: px-6 md:px-8 lg:px-12
- Section spacing: py-12 md:py-16

---

## Core Components

### Problem/Complaint Cards (Enhanced)
- Base card: rounded-lg border, p-6, hover elevation
- **Header row:** Title + Urgency badge (top-right)
- **Metadata row:** Username, timestamp, cluster count
- **Status indicator:** Solved/In Progress/Pending badge (inline, left-aligned)
- **Reaction bar:** Horizontal strip at bottom with:
  - Like/Dislike counters (👍 123 | 👎 12)
  - Emoji reactions (🔥 45 | ⚠️ 8 | ✅ 67) - display count only if >0
  - All reactions in single row: flex gap-3, text-sm
  - Active state: user's selected reaction highlighted with ring-2
- **Action menu:** Dropdown (right-aligned) with Delete/Edit/Mark Solved options

### Urgency Level Indicators
**Visual Treatment:** Badge with icon + text

- **Normal** (<10): Neutral styling, gray border
- **Urgent** (≥10): Subtle warning, amber accent
- **Critical** (≥25): Orange treatment, alert icon
- **Top Priority** (≥50): Red accent, high contrast
- **Emergency** (≥100): Intense red, pulsing animation (subtle)

**Implementation:** rounded-full px-3 py-1 text-xs font-semibold, positioned top-right of cards

### Status Badges
**Three states:**
- **Pending:** Outlined badge, muted styling
- **In Progress:** Filled badge, blue accent
- **Solved:** Filled badge with checkmark icon, success styling

**Position:** Below title, inline with metadata

### Reaction Buttons
**Interaction Panel:**
- Horizontal button group at card bottom
- Each button: p-2, rounded-md, hover state, gap-1 between icon and count
- Selected state: filled background, ring treatment
- Unselected: ghost button style
- Counter updates immediately on click

**Emoji Picker (Optional):** Small popover with 5 emoji options, appears on hover/click of "+" button

---

## Page Layouts

### Home Page (Leaderboard) - Enhanced
- Header with live stats: Total complaints, urgent count, critical count
- Filter sidebar (sticky): Filter by urgency, status (solved/pending), date range
- Card grid: 3-column (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Each card includes new reaction bar and urgency indicator
- Empty state: Centered message when no complaints meet threshold

### Admin Dashboard (Enhanced)
**Three-tab layout:**

**Tab 1: Urgency Dashboard**
- Stats row: 4 cards showing counts per urgency level
- Visual chart: Distribution of urgency levels (bar chart)
- Quick actions: Bulk mark as solved, bulk delete

**Tab 2: Abuse Logs**
- Table with flagged content, detection timestamp, user info
- Action buttons: Review, Ban User, Dismiss

**Tab 3: Complaint Management**
- Full CRUD table with inline editing
- Bulk selection checkboxes
- Status filter dropdown
- Search bar for content/username

**Admin Controls:**
- Every complaint card has "Edit" and "Delete" buttons visible to admins
- Modal for editing: Full-width textarea, status dropdown, urgency override

---

## Animations
- Hover transitions: 150ms ease
- Reaction button press: Scale animation (duration-100, scale-95)
- Urgency badge pulse (Emergency only): Subtle 2s infinite animation
- Status change: Brief flash animation (duration-300)
- NO scroll-triggered animations

---

## Icons
**Library:** Heroicons (CDN)

**Key Icons:**
- Urgency: Shield variants (shield, shield-exclamation, shield-check)
- Status: CheckCircle (solved), Clock (in progress), Circle (pending)
- Actions: Trash, Pencil, Flag
- Reactions: Embedded as emoji (native characters)

**Sizes:** w-4 h-4 for badges, w-5 h-5 for buttons

---

## Images
**Not applicable** for this dashboard-focused application. Focus on data visualization and clean UI.

---

## Accessibility
- Focus rings on all interactive elements (ring-2 ring-offset-2)
- ARIA labels for icon-only buttons
- Keyboard navigation for reaction buttons and dropdowns
- Screen reader announcements for status changes
- Semantic HTML throughout

---

## Key Interactions
1. **Reacting:** Click emoji/like/dislike → immediate count update + visual feedback
2. **Marking Solved:** Admin clicks "Mark Solved" → status badge updates + solved timestamp appears
3. **Deleting:** Delete button → confirmation dialog → removal with fade-out animation
4. **Urgency Updates:** Automatic recalculation on new complaint cluster → badge color change