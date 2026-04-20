# Campus Life OS

Campus Life OS is a front-end foundation for a student operating system dashboard built with **Next.js (App Router)**, **TypeScript**, and **Tailwind CSS**.

## What is included

- Responsive dashboard shell (sidebar + top header)
- Section pages:
  - Home
  - Academics
  - Planner
  - Fitness
  - Money
  - Settings
- Reusable UI cards and metric rows
- Realistic placeholder content for planning, academics, nutrition, and finances

## Tech stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4

## Project structure

```text
app/
  academics/page.tsx
  fitness/page.tsx
  money/page.tsx
  planner/page.tsx
  settings/page.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  layout/
    header.tsx
    sidebar.tsx
  ui/
    card.tsx
```

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start local dev server
- `npm run build` — production build
- `npm run start` — run production server
- `npm run lint` — run ESLint

## Notes

This version intentionally focuses on polished UI structure and reusable front-end building blocks only. Back-end logic, state persistence, authentication, and data integrations can be layered in next.

## Supabase Setup

1. Create a Supabase project
2. Copy Project URL
3. Copy Publishable Key
4. Add them to `.env.local`
5. Run `npm run dev`
6. Visit `/supabase-test`

## Canvas Sync V1 Setup

Canvas Sync V1 is a read-only REST integration. It imports Canvas courses and assignments into an isolated local store and does not overwrite existing Academics or Planner data.

Add these environment variables to `.env.local` for OAuth:

```bash
CANVAS_BASE_URL=
CANVAS_CLIENT_ID=
CANVAS_CLIENT_SECRET=
CANVAS_REDIRECT_URI=
```

Optional development-only fallback:

```bash
CANVAS_DEV_ACCESS_TOKEN=
```

Notes:

- `CANVAS_BASE_URL` should be the Canvas instance URL, for example `https://school.instructure.com`
- `CANVAS_REDIRECT_URI` should point to `/api/canvas/callback`
- OAuth secrets and tokens stay server-side only
- Imported Canvas data is stored separately under Canvas-specific local storage keys
