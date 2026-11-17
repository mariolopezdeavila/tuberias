-- =====================================================================
-- Tuberías — Supabase setup (run once in Supabase > SQL Editor > Run)
-- Free software, GPLv3. Safe to run again: it only creates what is missing
-- and replaces the functions.
--
-- Design:
--   * One table, LOCKED: nobody can read or write it directly with the
--     public (anon) key. All access goes through the functions below.
--   * Whoever creates a room gets a secret edit key (only its hash is stored).
--   * Anyone with the room code can view; only the edit key can save.
--   * Live updates travel over Supabase Realtime "broadcast" channels.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.tuberias_rooms (
  code          text primary key check (code ~ '^[A-Z0-9]{6}$'),
  edit_key_hash text not null,
  state         jsonb not null,
  listed        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.tuberias_rooms enable row level security;
-- No policies on purpose: direct access is denied to anon/authenticated users.
revoke all on table public.tuberias_rooms from anon, authenticated;

-- Create a room. Returns the room code and the secret edit key (shown once).
create or replace function public.tuberias_create_room(p_state jsonb)
returns table (room_code text, edit_key text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_key  text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid state';
  end if;
  if octet_length(p_state::text) > 400000 then
    raise exception 'state too large';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.tuberias_rooms r where r.code = v_code);
  end loop;
  v_key := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.tuberias_rooms (code, edit_key_hash, state, listed)
  values (v_code, encode(extensions.digest(v_key, 'sha256'), 'hex'), p_state,
          coalesce((p_state ->> 'listed')::boolean, false));
  return query select v_code, v_key;
end;
$$;

-- Read a room by code (anyone who knows the code).
create or replace function public.tuberias_get_room(p_code text)
returns table (room_code text, state jsonb, listed boolean, updated_at timestamptz)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select r.code, r.state, r.listed, r.updated_at
  from public.tuberias_rooms r
  where r.code = upper(p_code);
$$;

-- Save a room (only with the edit key). Returns the new update time.
create or replace function public.tuberias_save_room(p_code text, p_key text, p_state jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_now timestamptz := now();
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'invalid state';
  end if;
  if octet_length(p_state::text) > 400000 then
    raise exception 'state too large';
  end if;
  update public.tuberias_rooms r
     set state = p_state,
         listed = coalesce((p_state ->> 'listed')::boolean, false),
         updated_at = v_now
   where r.code = upper(p_code)
     and r.edit_key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  if not found then
    raise exception 'not allowed: wrong room code or edit key';
  end if;
  return v_now;
end;
$$;

-- Check whether an edit key is valid for a room (used to recover editing from an editor link).
create or replace function public.tuberias_check_key(p_code text, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.tuberias_rooms r
    where r.code = upper(p_code)
      and r.edit_key_hash = encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex'));
$$;

-- Lobby: rooms whose editor chose "Show in lobby", active in the last 3 days.
create or replace function public.tuberias_list_rooms()
returns table (room_code text, name text, team text, scenario_id text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select r.code, r.state ->> 'name', r.state ->> 'team', r.state ->> 'scenarioId', r.updated_at
  from public.tuberias_rooms r
  where r.listed and r.updated_at > now() - interval '3 days'
  order by r.updated_at desc
  limit 100;
$$;

revoke all on function public.tuberias_create_room(jsonb) from public;
revoke all on function public.tuberias_get_room(text) from public;
revoke all on function public.tuberias_save_room(text, text, jsonb) from public;
revoke all on function public.tuberias_check_key(text, text) from public;
revoke all on function public.tuberias_list_rooms() from public;
grant execute on function public.tuberias_create_room(jsonb) to anon, authenticated;
grant execute on function public.tuberias_get_room(text) to anon, authenticated;
grant execute on function public.tuberias_save_room(text, text, jsonb) to anon, authenticated;
grant execute on function public.tuberias_check_key(text, text) to anon, authenticated;
grant execute on function public.tuberias_list_rooms() to anon, authenticated;

-- Housekeeping (optional, run by hand when you want):
--   delete from public.tuberias_rooms where updated_at < now() - interval '30 days';
