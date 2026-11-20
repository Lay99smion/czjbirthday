-- Public blessing wall: visitors can read and submit, but cannot edit or delete.
create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_at timestamptz not null default now(),
  constraint wishes_content_length check (char_length(btrim(content)) between 1 and 120)
);

alter table public.wishes enable row level security;

revoke all privileges on table public.wishes from anon, authenticated;
grant select (id, content, created_at) on table public.wishes to anon;
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
