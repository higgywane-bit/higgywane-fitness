-- Superfit Thai QR (PromptPay) payments.
-- Run once in the Supabase SQL editor, after schema.sql and customer-app.sql (needs is_staff()). Safe to run again.
--
-- One row per "please pay ฿X": a cafe order from the app, or a charge rung up at the desk.
-- Rows are only written by the `promptpay` edge function (service role), which builds the QR with
-- lib/payments/promptpay.ts. Customers can read their own rows; staff read all. The app listens
-- on Realtime, so the customer's screen turns green the moment staff confirm.
--
-- How a payment gets confirmed:
--   staff  – they see it land in the gym's bank app and tap Confirm (works today, no contracts)
--   slip   – the customer scans the QR on their bank slip; the function stores the bank's
--            transaction reference (unique, so one slip can never pay twice) for staff to confirm,
--            or confirms it automatically once a slip-verification API is plugged in
--   gateway – a payment provider's webhook (Opn, 2C2P, a bank API) when the gym signs up for one

/* ── 1. Payment requests ──────────────────────────────────── */

create table if not exists public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('cafe_order', 'desk')),
  cafe_order_id uuid references public.cafe_orders(id) on delete set null,
  -- what the customer and staff see, e.g. the order number "SF-1042"
  reference text not null,
  member_id uuid references public.members(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  promptpay_id text not null,
  qr_payload text not null,
  status text not null default 'pending' check (status in ('pending', 'slip_sent', 'paid', 'expired', 'cancelled')),
  expires_at timestamptz not null,
  paid_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_via text check (confirmed_via in ('staff', 'slip', 'gateway')),
  -- from the bank slip's QR
  slip_trans_ref text,
  slip_bank text,
  slip_image_path text,
  slip_submitted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payment_intents_slip_ref_key on public.payment_intents (slip_trans_ref) where slip_trans_ref is not null;
create index if not exists payment_intents_order_idx on public.payment_intents (cafe_order_id);
create index if not exists payment_intents_open_idx on public.payment_intents (status, created_at desc) where status in ('pending', 'slip_sent');

alter table public.payment_intents enable row level security;
drop policy if exists "own or staff read payments" on public.payment_intents;
create policy "own or staff read payments" on public.payment_intents for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
-- no insert/update/delete policies: only the edge function writes

/* ── 2. Paid → the cafe order is paid ─────────────────────── */

create or replace function public.payment_intent_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' and new.cafe_order_id is not null then
    update public.cafe_orders
      set payment_status = 'paid', payment_method = 'promptpay', updated_at = now()
      where id = new.cafe_order_id;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_intent_paid on public.payment_intents;
create trigger payment_intent_paid after update of status on public.payment_intents
  for each row execute function public.payment_intent_paid();

/* ── 3. Live updates for the pay screen and the desk ──────── */

do $$
begin
  alter publication supabase_realtime add table public.payment_intents;
exception when duplicate_object then null;
end $$;

/* ── 4. Slip photos (private) ─────────────────────────────── */

insert into storage.buckets (id, name, public) values ('payment-slips', 'payment-slips', false)
on conflict (id) do nothing;

drop policy if exists "upload own slip" on storage.objects;
create policy "upload own slip" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-slips' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "read own slip or staff" on storage.objects;
create policy "read own slip or staff" on storage.objects for select to authenticated
  using (bucket_id = 'payment-slips' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

/* ── 5. Desk view: payments waiting for someone to look ───── */

create or replace view public.open_payments with (security_invoker = true) as
  select p.id, p.reference, p.amount, p.status, p.purpose, p.created_at, p.expires_at,
         p.slip_bank, p.slip_trans_ref, p.slip_submitted_at, p.slip_image_path,
         m.first_name, m.last_name, m.member_no
  from public.payment_intents p
  left join public.members m on m.id = p.member_id
  where p.status in ('pending', 'slip_sent')
     or (p.status = 'expired' and p.created_at > now() - interval '1 day');
