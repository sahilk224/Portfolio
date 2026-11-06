-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- 1) Replace you@gmail.com below with the Google account(s) allowed to edit.

create table if not exists public.site_content (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table public.site_content enable row level security;

-- Everyone can read the site.
drop policy if exists "public read" on public.site_content;
create policy "public read" on public.site_content for select using (true);

-- Only allow-listed emails can write.
create or replace function public.is_site_editor() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = any (array[
    'sahilnaangi225@gmail.com'
  ]);
$$;
drop policy if exists "editors write" on public.site_content;
create policy "editors write" on public.site_content for all
  using (public.is_site_editor()) with check (public.is_site_editor());

-- 2) Image/video uploads: a public bucket called "media".
insert into storage.buckets (id, name, public) values ('media', 'media', true)
  on conflict (id) do update set public = true;
drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "media editors upload" on storage.objects;
create policy "media editors upload" on storage.objects for insert
  with check (bucket_id = 'media' and public.is_site_editor());
drop policy if exists "media editors change" on storage.objects;
create policy "media editors change" on storage.objects for update
  using (bucket_id = 'media' and public.is_site_editor());
drop policy if exists "media editors delete" on storage.objects;
create policy "media editors delete" on storage.objects for delete
  using (bucket_id = 'media' and public.is_site_editor());
