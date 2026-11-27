-- In DBX, open the project's Supabase connection as the database owner and run
-- this entire file. Then refresh public and edit daily_notes directly in DBX.
-- The birthday project only reads these entries.
begin;

create table if not exists public.daily_notes (
  id bigint generated always as identity primary key,
  date date not null default ((now() at time zone 'Asia/Shanghai')::date),
  content text not null,
  constraint daily_notes_content_not_blank check (char_length(btrim(content)) > 0)
);

create index if not exists daily_notes_date_id_desc
  on public.daily_notes (date desc, id desc);

comment on table public.daily_notes is '我的碎碎念：在后台按日期填写正文；支持多段长文，同一天可有多篇。';
comment on column public.daily_notes.date is '日常发生的日期，默认北京时间今天；也可以手动填写往日日期。';

alter table public.daily_notes enable row level security;
revoke all privileges on table public.daily_notes from public, anon, authenticated;
revoke all privileges on sequence public.daily_notes_id_seq from public, anon, authenticated;
grant select (id, date, content) on table public.daily_notes to anon, authenticated;

drop policy if exists "Visitors can read daily notes" on public.daily_notes;
create policy "Visitors can read daily notes"
  on public.daily_notes for select to anon, authenticated using (true);

-- Existing rows stay NULL: historical visitor IPs cannot be reconstructed.
alter table public.wishes add column if not exists ip_address inet;
comment on column public.wishes.ip_address is '提交请求的公网 IP，仅后台可见；没有请求头的历史/后台数据可为空。';

create or replace function public.capture_wish_ip_address()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  headers jsonb;
  candidate text;
begin
  headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  -- Supabase's gateway forwards the visitor address. Read it at submission time;
  -- never accept a browser-supplied IP field or call a third-party IP service.
  candidate := nullif(btrim(headers ->> 'cf-connecting-ip'), '');
  if candidate is null then
    candidate := nullif(btrim(split_part(coalesce(headers ->> 'x-forwarded-for', ''), ',', 1)), '');
  end if;
  begin
    new.ip_address := candidate::inet;
  exception when invalid_text_representation then
    new.ip_address := null;
  end;
  return new;
end;
$$;

revoke all on function public.capture_wish_ip_address() from public, anon, authenticated;
drop trigger if exists wishes_capture_ip_address on public.wishes;
create trigger wishes_capture_ip_address
  before insert on public.wishes
  for each row execute function public.capture_wish_ip_address();

-- Preserve the existing blessing-wall policy while keeping the new IP private.
revoke select on table public.wishes from public, anon, authenticated;
revoke select (ip_address) on table public.wishes from public, anon, authenticated;
grant select (id, content, created_at, is_pinned) on public.wishes to anon;
revoke insert (ip_address), update (ip_address) on table public.wishes from public, anon, authenticated;
revoke insert on table public.wishes from public, anon, authenticated;
grant insert (content) on table public.wishes to anon;

notify pgrst, 'reload schema';
commit;
