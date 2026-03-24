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
lib/
  academics/
    mockData.ts
    types.ts
    utils.ts
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
