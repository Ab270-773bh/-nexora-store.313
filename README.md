# NEXORA — starter project

Arabic-first, mobile-friendly storefront starter using React, Vite and Supabase.

## Included
- RTL Arabic landing page and login / customer signup UI.
- Supabase Auth connection via environment variables.
- Initial schema for profiles, sellers, products, USD wallets, transactions, orders, withdrawals and support tickets.
- Starter RLS policies that intentionally do not allow browser-side wallet balance changes.

## Run locally
1. Install Node.js.
2. Copy `.env.example` to `.env` and fill in the Supabase Project URL and publishable/anon key.
3. Run `npm install`
4. Run `npm run dev`

## Supabase setup
1. Create a NEW Supabase project for this starter, or carefully review the SQL before using it in an existing project.
2. Open SQL Editor and review `supabase/schema.sql` before running it.
3. Enable email confirmation in Supabase Auth if you want confirmed email accounts.
4. Phone OTP requires a supported SMS provider and configuration in Supabase Auth. It is not active just because a phone field exists.

## Security notes
- Never put the Supabase `service_role` key in browser code or GitHub.
- Never let users edit wallet balances directly.
- Use audited server-side functions and idempotency keys for deposits, purchases, refunds and payouts.
- This starter is not a production-ready financial system and does not enable real payments.
- Country selection in the form is not a reliable geoblock. Enforce country restrictions server-side and confirm legal/payment-provider availability for Syria, Iraq and Iran before launch.
- Admin role assignment and seller approval must be implemented server-side; do not trust client-supplied metadata.
