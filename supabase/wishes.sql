-- Public blessing wall: visitors can read and submit, but cannot edit or delete.
-- Run the entire script as the database owner in Supabase SQL Editor.
-- Existing data is trimmed immediately: keep the first wish + the newest 99 others.
begin;

create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now(),
  is_pinned boolean not null default false,
  constraint wishes_content_length check (char_length(btrim(content)) between 1 and 120)
);

-- Also upgrade an existing wall. The lock keeps migration and new inserts apart.
alter table public.wishes add column if not exists is_pinned boolean not null default false;
lock table public.wishes in share row exclusive mode;

-- Re-running this script preserves the already-pinned first wish.
update public.wishes
set is_pinned = true
where id = (
  select id from public.wishes order by created_at asc, id asc limit 1
)
and not exists (select 1 from public.wishes where is_pinned);

create unique index if not exists wishes_one_pinned
  on public.wishes (is_pinned) where is_pinned;

create or replace function public.enforce_wishes_retention()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- All insert transactions take the same lock before assigning the first wish.
  -- It is held through commit, so concurrent submissions cannot bypass the cap.
  perform pg_catalog.pg_advisory_xact_lock(831027, 100);

  if TG_WHEN = 'BEFORE' then
    new.is_pinned := not exists (select 1 from public.wishes where is_pinned);
    return new;
  end if;

  -- AFTER STATEMENT sees every row of a bulk insert, not just its last row.
  delete from public.wishes
  where id in (
    select id from public.wishes
    where not is_pinned
    order by created_at desc, id desc
    offset 99
  );
  return null;
end;
$$;

revoke all on function public.enforce_wishes_retention() from public, anon, authenticated;

drop trigger if exists wishes_pin_first on public.wishes;
create trigger wishes_pin_first
  before insert on public.wishes
  for each row execute function public.enforce_wishes_retention();

drop trigger if exists wishes_limit_collection on public.wishes;
create trigger wishes_limit_collection
  after insert on public.wishes
  for each statement execute function public.enforce_wishes_retention();

-- Apply the same retention rule to any wishes already stored above the limit.
delete from public.wishes
where id in (
  select id from public.wishes
  where not is_pinned
  order by created_at desc, id desc
  offset 99
);

alter table public.wishes enable row level security;

revoke all privileges on table public.wishes from anon, authenticated;
grant select (id, content, created_at, is_pinned) on table public.wishes to anon;
grant insert (content) on table public.wishes to anon;

drop policy if exists "Anyone can read public wishes" on public.wishes;
create policy "Anyone can read public wishes"
  on public.wishes for select
  to anon
  using (true);

drop policy if exists "Anyone can submit a public wish" on public.wishes;
create policy "Anyone can submit a public wish"
  on public.wishes for insert
  to anon
  with check (char_length(btrim(content)) between 1 and 120);

commit;
