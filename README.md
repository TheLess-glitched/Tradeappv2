# TradeApp

TradeApp is a React Native business-management app for small service and retail businesses. It brings jobs, customers, product catalogue, inventory, sales, revenue summaries, and team access together in one mobile app.

## Description

TradeApp is built with Expo, Expo Router, React Native, TypeScript, and Supabase.

The application uses file-based routing. The root entry point is configured by `package.json` as `expo-router/entry`; root navigation, authentication, cart, theme, and app feedback providers are assembled in [app/_layout.tsx](app/_layout.tsx).

### Current app scope

- **Home and business overview:** see today's activity and navigate to jobs, sales, revenue history, team, and settings.
- **Jobs:** create and track service jobs through pending, in-progress, and done states; associate customers and catalogue items; add notes; and hand off completion messages to the device SMS app or WhatsApp.
- **Customers:** save and search customer contact records for use in jobs.
- **Catalogue and inventory:** manage items, prices, quantities, units, stock tracking, reorder levels, stock movements, and item notes. Quick sales check and decrement tracked stock; low-stock events can create notifications.
- **Sales:** build a quick-sale cart from tracked catalogue items, adjust quantities and prices, record sales, and review grouped sales. Stock decrement and sale creation are handled together by a database function.
- **Daily Close and revenue history:** review date-scoped job, sale, and revenue totals and browse historical revenue.
- **Voiding and audit trail:** void jobs or sales with a reason instead of silently deleting records. Voiding a tracked-stock sale restores its quantity. Database audit records retain changes to key business data.
- **Business teams:** create or join a business using an invite code. Owners can invite workers and manage team access; codes are single-use and expire after 48 hours.
- **Account and preferences:** sign in or create an account, use an account PIN gate, and configure the business profile, currency, appearance, default phone country code, and job-completion message.
- **Intermittent connectivity:** the app keeps selected successful reads locally and can show saved results when a request times out or the device is offline. This is a read fallback, not a full offline mode: writes are not queued for later synchronization.

## Install

Requirements:

- Node.js and npm
- An Expo-compatible simulator, device, or Expo Go
- A Supabase project with the application tables and policies configured

Install dependencies:

```bash
npm install
```

Configure the Supabase URL and public client key in [constants/supabase.ts](constants/supabase.ts). The client key is not a substitute for database security: enable Row Level Security and enforce authorization in database policies and functions. Never put a Supabase service-role key in the app.

Apply the SQL files in `supabase/migrations/` in filename order through the Supabase SQL Editor. These migrations add and evolve business membership and invite support, stock tracking, sale and void RPCs, audit logging, and related schema and policy changes. They are not a complete database bootstrap: create the base application schema first.

The database must contain the base tables used by the app, including `business_members`, `profiles`, `jobs`, `customers`, `catalogue`, `catalogue_stock_movements`, `catalogue_notes`, `inventory`, and `notifications`, together with the columns and policies required by the migrations. Business records are scoped by `business_id`; policies and RPCs must check the signed-in user's membership and role. The Quick Sell screen also calls a `record_sale_cart` RPC with its cart lines; this routine is not defined in the checked-in migrations and must be provided by the deployed database. Review the migrations and screen queries when setting up or changing the schema.

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

Create an account or sign in, then set or enter the account PIN. Create a business or join one with an invite code. The main tabs are Home, Jobs, Sales, Catalogue, and Customers; inventory, daily close, revenue history, team, notes, and settings are available from the app's navigation.

## API/Features

### Supabase data access

Screens use the shared Supabase client exported from [constants/supabase.ts](constants/supabase.ts). Authentication and active business membership are centralized in [context/auth-context.tsx](context/auth-context.tsx); cart state is shared through [context/cart-context.tsx](context/cart-context.tsx), and theme, currency, and PIN-unlock state are provided by [context/theme-context.tsx](context/theme-context.tsx).

The app reads and writes business data through Supabase. Selected successful GET responses and read-only RPC responses are cached locally for up to 14 days and may be used when a network request fails; the cache is scoped by request and is not a synchronization queue. Writes and transactional operations require a working connection. On reconnection, the app warms selected customer and catalogue reads for later access.

### Currency

Currency definitions and formatting are centralized in [constants/currency.ts](constants/currency.ts). The selected currency and other local preferences are stored on the device in `business_settings`; screens use the shared currency state when calling `formatCurrency()`.

### Catalogue stock tracking

Catalogue items can opt into stock tracking with `track_stock`. The Quick Sell flow calls the `record_sale_cart` PostgreSQL function to process the cart; deploy this function alongside the app because it is not included in the checked-in migrations. The migrations also define `record_sale` for a single item. Voiding a sale requires a reason and restores tracked stock where applicable.

### Business access and data safety

Business membership and role checks are part of the Supabase schema and RPC workflows. Invite codes are created by owners, expire after 48 hours, and can be used once to join as a worker. RLS policies must ensure that users can access only businesses they belong to and that owner-only actions remain restricted. The app also records database audit entries for changes to jobs, catalogue items, customers, and stock movements.

### Notifications

Completed jobs can open the device SMS application or WhatsApp with a formatted phone number and personalized completion message. TradeApp does not currently send messages from its own backend.

### Project structure

```text
app/                   Expo Router screens and route groups
app/(tabs)/             Main tab screens
components/            Shared UI components
constants/             Supabase client, caching, queries, theme, currency, and country data
context/               Shared authentication, cart, and theme state
hooks/                 Reusable React Native hooks
supabase/migrations/   SQL schema changes, policies, and database functions
scripts/               Project maintenance scripts
```

## Contributing

1. Create a focused branch for the change.
2. Keep screen-specific UI in the owning route and shared state in `context/` or `constants/` when it is used across screens.
3. Preserve business membership scoping in Supabase queries, RPCs, and RLS policies; keep owner/worker permissions aligned with the application behavior.
4. Run linting and TypeScript checks before opening a pull request:

```bash
npm run lint
npx tsc --noEmit
```

5. Describe database migration requirements and manual verification steps in the pull request. For changes to sales, stock, voiding, or business membership, verify the corresponding database behavior as well as the UI.

There is currently no automated test directory or test script in `package.json`. New behavior should include focused tests when a suitable test runner is added, plus manual verification on the relevant Expo target.

## License

No license file or license declaration is currently included in this repository. All rights are reserved unless the project owner publishes separate licensing terms.
