-- ZylumGraph: per-user canvases, edges, preferences, and RLS.
-- Apply in Supabase SQL Editor or via CLI after reviewing policies on your project.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.canvases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled canvas',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canvases_user_id_idx on public.canvases (user_id);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Link documents to a canvas (nullable for legacy rows; app requires canvas_id for new uploads)
alter table public.documents add column if not exists canvas_id uuid references public.canvases (id) on delete cascade;

create index if not exists documents_canvas_id_idx on public.documents (canvas_id);

create table if not exists public.canvas_edges (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid not null references public.canvases (id) on delete cascade,
  source_node_id uuid not null references public.nodes (id) on delete cascade,
  target_node_id uuid not null references public.nodes (id) on delete cascade,
  label text,
  weight real not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists canvas_edges_canvas_id_idx on public.canvas_edges (canvas_id);

-- ---------------------------------------------------------------------------
-- updated_at on canvases
-- ---------------------------------------------------------------------------

create or replace function public.zylum_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists canvases_set_updated_at on public.canvases;
create trigger canvases_set_updated_at
  before update on public.canvases
  for each row execute procedure public.zylum_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.canvases enable row level security;
alter table public.user_preferences enable row level security;
alter table public.canvas_edges enable row level security;
alter table public.documents enable row level security;
alter table public.nodes enable row level security;
alter table public.chunks enable row level security;

-- Canvases: owner only
drop policy if exists "canvases_select_own" on public.canvases;
create policy "canvases_select_own" on public.canvases for select using (auth.uid() = user_id);

drop policy if exists "canvases_insert_own" on public.canvases;
create policy "canvases_insert_own" on public.canvases for insert with check (auth.uid() = user_id);

drop policy if exists "canvases_update_own" on public.canvases;
create policy "canvases_update_own" on public.canvases for update using (auth.uid() = user_id);

drop policy if exists "canvases_delete_own" on public.canvases;
create policy "canvases_delete_own" on public.canvases for delete using (auth.uid() = user_id);

-- Theme / prefs
drop policy if exists "user_prefs_all_own" on public.user_preferences;
create policy "user_prefs_all_own" on public.user_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Documents: must belong to a canvas owned by the user
drop policy if exists "documents_select_via_canvas" on public.documents;
create policy "documents_select_via_canvas" on public.documents for select using (
  canvas_id is not null
  and exists (
    select 1 from public.canvases c
    where c.id = documents.canvas_id and c.user_id = auth.uid()
  )
);

drop policy if exists "documents_insert_via_canvas" on public.documents;
create policy "documents_insert_via_canvas" on public.documents for insert with check (
  canvas_id is not null
  and exists (
    select 1 from public.canvases c
    where c.id = documents.canvas_id and c.user_id = auth.uid()
  )
);

drop policy if exists "documents_update_via_canvas" on public.documents;
create policy "documents_update_via_canvas" on public.documents for update using (
  canvas_id is not null
  and exists (
    select 1 from public.canvases c
    where c.id = documents.canvas_id and c.user_id = auth.uid()
  )
);

drop policy if exists "documents_delete_via_canvas" on public.documents;
create policy "documents_delete_via_canvas" on public.documents for delete using (
  canvas_id is not null
  and exists (
    select 1 from public.canvases c
    where c.id = documents.canvas_id and c.user_id = auth.uid()
  )
);

-- Nodes: via document → canvas
drop policy if exists "nodes_select_via_doc" on public.nodes;
create policy "nodes_select_via_doc" on public.nodes for select using (
  exists (
    select 1 from public.documents d
    join public.canvases c on c.id = d.canvas_id
    where d.id = nodes.document_id and c.user_id = auth.uid()
  )
);

-- Ingest workers using the service role bypass RLS. If your worker uses the anon key,
-- add insert/update policies that match your deployment.
drop policy if exists "nodes_modify_via_doc" on public.nodes;
create policy "nodes_modify_via_doc" on public.nodes for insert with check (
  exists (
    select 1 from public.documents d
    join public.canvases c on c.id = d.canvas_id
    where d.id = nodes.document_id and c.user_id = auth.uid()
  )
);

drop policy if exists "nodes_update_via_doc" on public.nodes;
create policy "nodes_update_via_doc" on public.nodes for update using (
  exists (
    select 1 from public.documents d
    join public.canvases c on c.id = d.canvas_id
    where d.id = nodes.document_id and c.user_id = auth.uid()
  )
);

-- Chunks: via document
drop policy if exists "chunks_select_via_doc" on public.chunks;
create policy "chunks_select_via_doc" on public.chunks for select using (
  exists (
    select 1 from public.documents d
    join public.canvases c on c.id = d.canvas_id
    where d.id = chunks.document_id and c.user_id = auth.uid()
  )
);

drop policy if exists "chunks_modify_via_doc" on public.chunks;
create policy "chunks_modify_via_doc" on public.chunks for insert with check (
  exists (
    select 1 from public.documents d
    join public.canvases c on c.id = d.canvas_id
    where d.id = chunks.document_id and c.user_id = auth.uid()
  )
);

drop policy if exists "chunks_update_via_doc" on public.chunks;
create policy "chunks_update_via_doc" on public.chunks for update using (
  exists (
    select 1 from public.documents d
    join public.canvases c on c.id = d.canvas_id
    where d.id = chunks.document_id and c.user_id = auth.uid()
  )
);

-- Graph edges (single policy for CRUD)
drop policy if exists "canvas_edges_select" on public.canvas_edges;
drop policy if exists "canvas_edges_write" on public.canvas_edges;
drop policy if exists "canvas_edges_all" on public.canvas_edges;
create policy "canvas_edges_all" on public.canvas_edges for all
  using (exists (select 1 from public.canvases c where c.id = canvas_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.canvases c where c.id = canvas_id and c.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage (archives bucket): optional — create policies in Dashboard so paths
-- look like:  <auth.uid()>/<filename>
-- ---------------------------------------------------------------------------
