# DO NOT TOUCH

## Architecture Lock

**DO NOT:**
- Change frameworks (Vite, Express, React)
- Migrate to Next.js or any other framework
- Delete config files (vite.config.ts, drizzle.config.ts, tsconfig.json, etc.)
- Restructure folders (client/, server/, shared/)
- Change the build system
- Remove or replace dependencies without explicit approval

## This Project Uses

- **Frontend**: Vite + React + TypeScript
- **Backend**: Express + TypeScript
- **Database**: Drizzle ORM + PostgreSQL (Neon)
- **Routing**: Wouter (client-side routing)
- **State Management**: TanStack Query (React Query)
- **UI Components**: Radix UI + Tailwind CSS

## Allowed Changes

- Adding new features within the existing architecture
- Updating dependencies (with caution)
- Adding new routes and components
- Extending the database schema
- Adding new API endpoints

## When in Doubt

Ask before making architectural changes. Only add features where explicitly told.

---

**This file serves as a lock to prevent unwanted architectural changes.**

