# TradeApp

TradeApp is a React Native business-management app for service-based businesses. It provides job tracking, customer records, catalogue and stock management, daily revenue summaries, configurable currencies, and handoff to SMS or WhatsApp for customer communication.

## Description

TradeApp is built with Expo, Expo Router, React Native, TypeScript, and Supabase.

The application uses file-based routing. The root entry point is configured by `package.json` as `expo-router/entry`; the root navigation and providers are assembled in [app/_layout.tsx](app/_layout.tsx).

Main application areas include:

- Jobs: create jobs and move them through pending, in-progress, and done states.
- Customers: maintain customer contact details and search the customer directory.
- Catalogue: manage catalogue items, prices, quantities, reorder levels, and stock movements.
- Inventory: track stock quantities and low-stock thresholds.
- Daily Close: view date-scoped daily revenue and job totals.
- Settings: configure business details, theme mode, currency, PIN security, and completion messages.
- Authentication: Supabase authentication with a local PIN gate.

## Install

Requirements:

- Node.js and npm
- An Expo-compatible simulator, device, or Expo Go
- A Supabase project with the application tables and policies configured

Install dependencies:

```bash
npm install
```

Configure Supabase in [constants/supabase.ts](constants/supabase.ts). The current project stores the Supabase URL and anonymous key in that file. For production deployments, use an appropriate environment-variable or build-secret strategy instead of committing service configuration directly to source control.

Apply the SQL files in `supabase/migrations/` through the Supabase SQL Editor. The current migrations add the catalogue `track_stock` column and define the `decrement_catalogue_stock` RPC.

The database must also contain the application tables used by the screens, including `jobs`, `customers`, `catalogue`, `catalogue_stock_movements`, `catalogue_notes`, and `inventory`. Each user-scoped table should have Row Level Security policies that restrict reads and writes to the authenticated user's `user_id`.

## Usage

Start the Expo development server:

```bash
npm start
```

Then use the Expo CLI to open a target:

```bash
npm run android
npm run ios
npm run web
```

Useful project commands:

```bash
npm run lint
npx tsc --noEmit
```

After signing in, create or confirm the local PIN. From the tab navigation, use Home, Jobs, Customers, Catalogue, or More to access the main workflows.

## API/Features

### Supabase data access

Screens use the shared Supabase client exported from [constants/supabase.ts](constants/supabase.ts). Authentication state is centralized in [context/auth-context.tsx](context/auth-context.tsx), while theme, currency, and PIN-unlock state are provided by [context/theme-context.tsx](context/theme-context.tsx).

The app currently calls Supabase directly for jobs, customers, catalogue items, inventory, notes, and stock movements. It is not offline-first: domain records are not cached locally and failed writes are not queued for later synchronization.

### Currency

Currency definitions and formatting are centralized in [constants/currency.ts](constants/currency.ts). Settings persists the selected currency in `business_settings`, and screens use the shared currency state when calling `formatCurrency()`.

### Catalogue stock tracking

Catalogue items can opt into stock tracking with `track_stock`. When a tracked catalogue item is used to create a job, the `decrement_catalogue_stock` PostgreSQL function atomically decrements quantity without allowing a negative value and records a `Job creation` movement in `catalogue_stock_movements`.

### Notifications

Completed jobs can open the device SMS application or WhatsApp with a formatted phone number and personalized completion message. TradeApp does not currently send messages from its own backend.

### Project structure

```text
app/                  Expo Router screens and route groups
app/(tabs)/            Main tab screens
components/            Shared UI components
constants/             Supabase client, theme, currency, and country data
context/               Shared authentication and theme state
hooks/                 Reusable React Native hooks
supabase/migrations/   SQL changes and database functions
scripts/               Project maintenance scripts
```

## Contributing

1. Create a focused branch for the change.
2. Keep screen-specific UI in the owning route and shared state in `context/` or `constants/` when it is used across screens.
3. Preserve user scoping in every Supabase query and keep RLS policies aligned with the application behavior.
4. Run linting and TypeScript checks before opening a pull request:

```bash
npm run lint
npx tsc --noEmit
```

5. Describe database migration requirements and manual verification steps in the pull request.

There is currently no automated test directory or test script in `package.json`. New behavior should include focused tests when a suitable test runner is added, plus manual verification on the relevant Expo target.

## License

No license file or license declaration is currently included in this repository. All rights are reserved unless the project owner publishes separate licensing terms.
