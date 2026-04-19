-- Episteme MVP: pgvector + core tables + Realtime + permissive RLS (demo only)

create extension if not exists vector;

-- Raw uploaded files
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  file_url text not null,
  created_at timestamptz default now()
);

-- Extracted entities for React Flow
create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  type text not null,
  name text not null,
  summary text,
  x_pos float default 0,
  y_pos float default 0
);

-- Text chunks + embeddings (768-dim, e.g. nomic-embed-text)
create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  node_id uuid references public.nodes(id) on delete set null,
  content text not null,
  embedding vector(768)
);

create index if not exists chunks_document_id_idx on public.chunks (document_id);
create index if not exists chunks_node_id_idx on public.chunks (node_id);
create index if not exists nodes_document_id_idx on public.nodes (document_id);

-- Realtime: broadcast inserts/updates on nodes
alter table public.nodes replica identity full;

-- Idempotent on re-run: ignore if already a member of the publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'nodes' and schemaname = 'public'
  ) then
    execute 'alter publication supabase_realtime add table public.nodes';
  end if;
end $$;

-- Storage bucket (public for MVP PDF URLs)
insert into storage.buckets (id, name, public)
values ('archives', 'archives', true)
on conflict (id) do update set public = excluded.public;

-- RLS
alter table public.documents enable row level security;
alter table public.nodes enable row level security;
alter table public.chunks enable row level security;

-- MVP demo policies: open access (replace before production)
create policy "documents_select_mvp" on public.documents for select using (true);
create policy "documents_insert_mvp" on public.documents for insert with check (true);
create policy "documents_update_mvp" on public.documents for update using (true) with check (true);

create policy "nodes_select_mvp" on public.nodes for select using (true);
create policy "nodes_insert_mvp" on public.nodes for insert with check (true);
create policy "nodes_update_mvp" on public.nodes for update using (true) with check (true);

create policy "chunks_select_mvp" on public.chunks for select using (true);
create policy "chunks_insert_mvp" on public.chunks for insert with check (true);
create policy "chunks_update_mvp" on public.chunks for update using (true) with check (true);

-- Storage: allow anon/authenticated to read/write archives (MVP)
create policy "archives_select_mvp"
  on storage.objects for select
  using (bucket_id = 'archives');

create policy "archives_insert_mvp"
  on storage.objects for insert
  with check (bucket_id = 'archives');

create policy "archives_update_mvp"
  on storage.objects for update
  using (bucket_id = 'archives')
  with check (bucket_id = 'archives');

create policy "archives_delete_mvp"
  on storage.objects for delete
  using (bucket_id = 'archives');
