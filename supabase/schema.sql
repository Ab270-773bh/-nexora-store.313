-- NEXORA initial schema. Review before running on any existing project.
-- Run only in a NEW Supabase project or after confirming there are no name conflicts.

create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'seller', 'support', 'delivery', 'admin');
create type public.country_code as enum ('SY', 'IQ', 'IR');
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.wallet_tx_type as enum ('deposit', 'withdrawal', 'purchase', 'sale_credit', 'delivery_fee', 'refund', 'adjustment');
create type public.wallet_tx_status as enum ('pending', 'posted', 'rejected', 'reversed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  country public.country_code,
  role public.app_role not null default 'customer',
  phone text,
  phone_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.seller_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  store_name text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.seller_profiles(user_id),
  name text not null,
  description text,
  image_url text,
  price_usd numeric(12,2) not null check (price_usd >= 0),
  stock integer not null default 0 check (stock >= 0),
  status public.product_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id),
  currency char(3) not null default 'USD' check (currency = 'USD'),
  -- Cached balance is not directly writable by users; server-side financial functions update it.
  balance_usd numeric(14,2) not null default 0 check (balance_usd >= 0),
  created_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id),
  actor_id uuid references public.profiles(id),
  tx_type public.wallet_tx_type not null,
  status public.wallet_tx_status not null default 'pending',
  amount_usd numeric(14,2) not null check (amount_usd > 0),
  reference text,
  idempotency_key text unique,
  note text,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  seller_id uuid not null references public.seller_profiles(user_id),
  country public.country_code not null,
  currency char(3) not null default 'USD' check (currency = 'USD'),
  subtotal_usd numeric(14,2) not null check (subtotal_usd >= 0),
  delivery_fee_usd numeric(14,2) not null default 0 check (delivery_fee_usd >= 0),
  status text not null default 'pending' check (status in ('pending','paid','assigned','shipped','delivered','cancelled','refunded')),
  delivery_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name_snapshot text not null,
  unit_price_usd numeric(12,2) not null check (unit_price_usd >= 0),
  quantity integer not null check (quantity > 0),
  seller_id uuid not null references public.seller_profiles(user_id)
);

create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount_usd numeric(14,2) not null check (amount_usd > 0),
  country public.country_code not null,
  payment_method text not null,
  payment_details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  assigned_to uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index products_seller_status_idx on public.products(seller_id, status);
create index orders_buyer_created_idx on public.orders(buyer_id, created_at desc);
create index orders_seller_created_idx on public.orders(seller_id, created_at desc);
create index wallet_transactions_wallet_created_idx on public.wallet_transactions(wallet_id, created_at desc);

-- Create a customer profile and an empty USD wallet when Auth creates a user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_country public.country_code;
begin
  chosen_country := case
    when new.raw_user_meta_data ->> 'country' in ('SY','IQ','IR')
      then (new.raw_user_meta_data ->> 'country')::public.country_code
    else null
  end;

  insert into public.profiles (id, country, role)
  values (new.id, chosen_country, 'customer')
  on conflict (id) do nothing;

  insert into public.wallets (owner_id, currency, balance_usd)
  values (new.id, 'USD', 0)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.products enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.withdrawal_requests enable row level security;
alter table public.support_tickets enable row level security;

-- Users can read their own profile; no client-side role or phone-verification edits.
create policy "profiles_select_own" on public.profiles
for select to authenticated using (id = (select auth.uid()));

-- Approved sellers' active products can be browsed. Sellers manage only their own products.
create policy "products_read_active_or_own" on public.products
for select to authenticated using (
  status = 'active'
  or seller_id = (select auth.uid())
);
create policy "seller_insert_own_products" on public.products
for insert to authenticated with check (
  seller_id = (select auth.uid())
  and exists (
    select 1 from public.seller_profiles s
    where s.user_id = (select auth.uid()) and s.approved = true
  )
);
create policy "seller_update_own_products" on public.products
for update to authenticated using (seller_id = (select auth.uid()))
with check (seller_id = (select auth.uid()));
create policy "seller_delete_own_drafts" on public.products
for delete to authenticated using (
  seller_id = (select auth.uid()) and status = 'draft'
);

create policy "seller_profile_read_own" on public.seller_profiles
for select to authenticated using (user_id = (select auth.uid()));

-- Wallets and transactions are read-only from the browser. Do not add client INSERT/UPDATE policies.
create policy "wallet_read_own" on public.wallets
for select to authenticated using (owner_id = (select auth.uid()));
create policy "transactions_read_own_wallet" on public.wallet_transactions
for select to authenticated using (
  exists (
    select 1 from public.wallets w
    where w.id = wallet_id and w.owner_id = (select auth.uid())
  )
);

create policy "orders_read_buyer_or_seller_or_assigned_delivery" on public.orders
for select to authenticated using (
  buyer_id = (select auth.uid())
  or seller_id = (select auth.uid())
  or delivery_user_id = (select auth.uid())
);
create policy "order_items_read_related_order" on public.order_items
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_id and (
      o.buyer_id = (select auth.uid())
      or o.seller_id = (select auth.uid())
      or o.delivery_user_id = (select auth.uid())
    )
  )
);

create policy "withdrawals_read_own" on public.withdrawal_requests
for select to authenticated using (user_id = (select auth.uid()));
create policy "withdrawals_submit_own" on public.withdrawal_requests
for insert to authenticated with check (
  user_id = (select auth.uid())
);
create policy "tickets_read_own_or_assigned" on public.support_tickets
for select to authenticated using (
  user_id = (select auth.uid()) or assigned_to = (select auth.uid())
);
create policy "tickets_submit_own" on public.support_tickets
for insert to authenticated with check (user_id = (select auth.uid()));

-- IMPORTANT:
-- This starter intentionally has no browser policy to change wallet balances,
-- post financial transactions, approve sellers, assign staff roles, or mark withdrawals paid.
-- Add audited server-side RPC/Edge Functions after the business rules and payment providers are verified.
