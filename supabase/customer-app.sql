-- Superfit customer app: app accounts (Google / Apple / email link) connected to members.
-- Run once in the Supabase SQL editor, after schema.sql. Safe to run again.
--
-- Customers never read tables directly. The app calls my_account() and friends, which only
-- ever return the signed-in person's own member. Linking happens in the edge functions
-- (supabase/functions), which run the same rules as lib/customer/link.ts.

/* ── 1. Staff accounts ────────────────────────────────────────
   Who may use the admin tools (invite, link, the App requests queue).
   If your project already has a roles table (e.g. user_roles + has_role()), change the body
   of is_staff() to use it instead and skip the insert at the bottom of this section. */

create table if not exists public.staff_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);
alter table public.staff_accounts enable row level security;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_accounts where user_id = auth.uid());
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- Make the admin login a staff account (change the email, then run this line):
-- insert into public.staff_accounts (user_id, role) select id, 'owner' from auth.users where email = 'owner@example.com' on conflict do nothing;

/* ── 2. Members get an app account ────────────────────────── */

alter table public.members add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.members add column if not exists app_linked_at timestamptz;
create unique index if not exists members_user_id_key on public.members (user_id) where user_id is not null;

/* ── 3. Invites sent from the desk ────────────────────────── */

create table if not exists public.member_invites (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz
);
create index if not exists member_invites_open_email_idx on public.member_invites (lower(email)) where used_at is null;
create index if not exists member_invites_member_idx on public.member_invites (member_id);
alter table public.member_invites enable row level security;
drop policy if exists "staff read invites" on public.member_invites;
create policy "staff read invites" on public.member_invites for select to authenticated using (public.is_staff());

/* ── 4. Accounts waiting to be linked (the admin "App requests" queue) ── */

create table if not exists public.account_link_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  email_verified boolean not null default false,
  full_name text,
  phone text,
  avatar_url text,
  -- unverified | no-match | several-matches | already-linked
  reason text,
  -- [{ memberId, score, reasons }] from suggestMatches()
  suggestions jsonb not null default '[]'::jsonb,
  -- what the app's link QR holds (SF-LINK-<token>); fresh for 15 minutes
  desk_token text unique,
  desk_token_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'linked', 'dismissed')),
  member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);
create index if not exists account_link_requests_pending_idx on public.account_link_requests (created_at desc) where status = 'pending';
alter table public.account_link_requests enable row level security;
drop policy if exists "own request" on public.account_link_requests;
create policy "own request" on public.account_link_requests for select to authenticated using (user_id = auth.uid() or public.is_staff());
-- No insert/update policies: only the edge functions (service role) write here.

/* ── 5. The customer app's one read: my_account() ─────────── */

create or replace function public.my_account() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m public.members;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into m from public.members where user_id = uid and archived_at is null;
  if not found then
    return jsonb_build_object(
      'linked', false,
      'request', (
        select jsonb_build_object('status', r.status, 'reason', r.reason, 'deskToken', r.desk_token, 'deskTokenAt', r.desk_token_at)
        from public.account_link_requests r where r.user_id = uid
      )
    );
  end if;

  return jsonb_build_object(
    'linked', true,
    'member', jsonb_build_object(
      'id', m.id, 'memberNo', m.member_no, 'firstName', m.first_name, 'lastName', m.last_name,
      'nickname', m.nickname, 'email', m.email, 'phone', m.phone, 'photoUrl', m.photo_url,
      'memberSince', m.created_at
    ),
    'credentials', coalesce((
      select jsonb_agg(jsonb_build_object('kind', c.kind, 'code', c.code, 'createdAt', c.created_at, 'revokedAt', c.revoked_at))
      from public.credentials c where c.member_id = m.id and c.revoked_at is null
    ), '[]'::jsonb),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'kind', x.kind, 'planName', x.plan_name, 'startsOn', x.starts_on, 'endsOn', x.ends_on,
        'frozenFrom', x.frozen_from, 'frozenUntil', x.frozen_until, 'cancelledAt', x.cancelled_at,
        'sessionsTotal', x.sessions_total, 'sessionsUsed', x.sessions_used
      ) order by x.starts_on)
      from public.memberships x where x.member_id = m.id
    ), '[]'::jsonb),
    'checkIns', coalesce((
      select jsonb_agg(jsonb_build_object('at', t.at, 'allowed', t.allowed) order by t.at desc)
      from (select at, allowed from public.check_ins where member_id = m.id order by at desc limit 60) t
    ), '[]'::jsonb),
    'ptSessions', coalesce((
      select jsonb_agg(jsonb_build_object('at', t.at, 'status', t.status, 'coachId', t.coach_id) order by t.at desc)
      from (select at, status, coach_id from public.pt_sessions where member_id = m.id order by at desc limit 30) t
    ), '[]'::jsonb),
    'ptRequests', coalesce((
      select jsonb_agg(jsonb_build_object('reference', b.reference, 'coachSlug', b.coach_slug, 'date', b.date, 'time', b.time, 'status', b.status) order by b.date desc)
      from (select * from public.pt_bookings where member_id = m.id order by created_at desc limit 20) b
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.my_account() from public, anon;
grant execute on function public.my_account() to authenticated;

/* ── 6. Profile photo (shown to staff on every check-in) ───── */

insert into storage.buckets (id, name, public) values ('member-photos', 'member-photos', true) on conflict (id) do nothing;

drop policy if exists "upload own photo" on storage.objects;
create policy "upload own photo" on storage.objects for insert to authenticated
  with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "replace own photo" on storage.objects;
create policy "replace own photo" on storage.objects for update to authenticated
  using (bucket_id = 'member-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- The app uploads to member-photos/<user id>/<file>, then saves the public URL here.
create or replace function public.set_my_photo(photo_url text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if photo_url !~ ('^https://[^/]+/storage/v1/object/public/member-photos/' || uid::text || '/') then
    raise exception 'Upload the photo to your own folder first';
  end if;
  update public.members set photo_url = set_my_photo.photo_url, updated_at = now() where user_id = uid;
  insert into public.activity (member_id, type, message)
    select id, 'app.photo', 'Updated their photo in the app' from public.members where user_id = uid;
end;
$$;
revoke all on function public.set_my_photo(text) from public, anon;
grant execute on function public.set_my_photo(text) to authenticated;

/* ── 7. PT: ask a coach for a session ─────────────────────── */

create or replace function public.request_pt_session(coach text, on_date date, at_time text, goal_text text default null, note_text text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  m public.members;
  ref text := 'PT-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
begin
  if uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into m from public.members where user_id = uid and archived_at is null;
  if not found then raise exception 'Link your membership first'; end if;
  if on_date < (now() at time zone 'Asia/Bangkok')::date then raise exception 'Pick a day from today on'; end if;
  if at_time !~ '^\d{2}:\d{2}$' then raise exception 'Pick a time'; end if;
  if (select count(*) from public.pt_bookings where member_id = m.id and status = 'requested') >= 3 then
    raise exception 'You already have 3 requests waiting. The coach will reply soon.';
  end if;

  insert into public.pt_bookings (reference, coach_slug, date, time, name, contact, goal, note, status, member_id)
  values (ref, coach, on_date, at_time, trim(m.first_name || ' ' || m.last_name), coalesce(m.phone, m.email, ''),
          left(goal_text, 200), left(note_text, 500), 'requested', m.id);
  insert into public.activity (member_id, type, message)
  values (m.id, 'app.pt-request', 'Asked for a PT session in the app: ' || coach || ' ' || on_date || ' ' || at_time);
  return jsonb_build_object('reference', ref);
end;
$$;
revoke all on function public.request_pt_session(text, date, text, text, text) from public, anon;
grant execute on function public.request_pt_session(text, date, text, text, text) to authenticated;

/* ── 8. Catalog for the app (menu, coaches, plans, business) ── */

-- Sections saved in admin live in app_settings as catalog:<section>; null means "use the defaults".
create or replace function public.public_catalog() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(replace(key, 'catalog:', ''), value), '{}'::jsonb)
  from public.app_settings
  where key in ('catalog:categories', 'catalog:menu', 'catalog:optionGroups', 'catalog:ingredients', 'catalog:coaches', 'catalog:plans', 'catalog:business');
$$;
grant execute on function public.public_catalog() to anon, authenticated;

/* ── 9. Check your tables are locked down ─────────────────────
   Customers sign in to the same Supabase project as the admin. Any table with RLS OFF can be
   read by every signed-in customer through the API. Run this; every row should say true:

   select relname, relrowsecurity from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname;

   For any that say false, turn RLS on and give staff full access, e.g. for members:

   alter table public.members enable row level security;
   create policy "staff all" on public.members for all to authenticated using (public.is_staff()) with check (public.is_staff());

   (Do this only once your admin login is in staff_accounts, or the admin will see empty lists.) */
