-- Episteme Study persistence: decks, quizzes, sessions, and review events.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.study_decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canvas_id uuid not null references public.canvases (id) on delete cascade,
  node_id uuid references public.nodes (id) on delete set null,
  title text not null default 'Generated deck',
  source_context text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_decks_user_id_idx on public.study_decks (user_id);
create index if not exists study_decks_canvas_id_idx on public.study_decks (canvas_id);
create index if not exists study_decks_created_at_idx on public.study_decks (created_at desc);

create table if not exists public.study_flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.study_decks (id) on delete cascade,
  position integer not null,
  front text not null,
  back text not null,
  created_at timestamptz not null default now(),
  unique (deck_id, position)
);

create index if not exists study_flashcards_deck_id_idx on public.study_flashcards (deck_id);

create table if not exists public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canvas_id uuid not null references public.canvases (id) on delete cascade,
  node_id uuid references public.nodes (id) on delete set null,
  title text not null default 'Generated quiz',
  source_context text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quiz_sets_user_id_idx on public.quiz_sets (user_id);
create index if not exists quiz_sets_canvas_id_idx on public.quiz_sets (canvas_id);
create index if not exists quiz_sets_created_at_idx on public.quiz_sets (created_at desc);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_set_id uuid not null references public.quiz_sets (id) on delete cascade,
  position integer not null,
  question text not null,
  options jsonb not null,
  answer_index integer not null check (answer_index between 0 and 3),
  explanation text,
  created_at timestamptz not null default now(),
  unique (quiz_set_id, position),
  constraint quiz_questions_options_array check (jsonb_typeof(options) = 'array')
);

create index if not exists quiz_questions_quiz_set_id_idx on public.quiz_questions (quiz_set_id);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canvas_id uuid not null references public.canvases (id) on delete cascade,
  deck_id uuid references public.study_decks (id) on delete set null,
  quiz_set_id uuid references public.quiz_sets (id) on delete set null,
  session_type text not null check (session_type in ('flashcards', 'quiz', 'chat')),
  score integer,
  total integer,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists study_sessions_user_id_idx on public.study_sessions (user_id);
create index if not exists study_sessions_canvas_id_idx on public.study_sessions (canvas_id);
create index if not exists study_sessions_started_at_idx on public.study_sessions (started_at desc);

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  canvas_id uuid not null references public.canvases (id) on delete cascade,
  deck_id uuid references public.study_decks (id) on delete set null,
  flashcard_id uuid references public.study_flashcards (id) on delete set null,
  quiz_set_id uuid references public.quiz_sets (id) on delete set null,
  quiz_question_id uuid references public.quiz_questions (id) on delete set null,
  session_id uuid references public.study_sessions (id) on delete set null,
  result text not null check (result in ('got_it', 'needs_review', 'correct', 'incorrect')),
  confidence smallint check (confidence between 1 and 5),
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz not null default now()
);

create index if not exists review_events_user_id_idx on public.review_events (user_id);
create index if not exists review_events_canvas_id_idx on public.review_events (canvas_id);
create index if not exists review_events_reviewed_at_idx on public.review_events (reviewed_at desc);
create index if not exists review_events_flashcard_id_idx on public.review_events (flashcard_id);
create index if not exists review_events_quiz_question_id_idx on public.review_events (quiz_question_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
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

drop trigger if exists study_decks_set_updated_at on public.study_decks;
create trigger study_decks_set_updated_at
  before update on public.study_decks
  for each row execute procedure public.zylum_set_updated_at();

drop trigger if exists quiz_sets_set_updated_at on public.quiz_sets;
create trigger quiz_sets_set_updated_at
  before update on public.quiz_sets
  for each row execute procedure public.zylum_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.study_decks enable row level security;
alter table public.study_flashcards enable row level security;
alter table public.quiz_sets enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.study_sessions enable row level security;
alter table public.review_events enable row level security;

-- Owner tables.
drop policy if exists "study_decks_all_own" on public.study_decks;
create policy "study_decks_all_own" on public.study_decks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "quiz_sets_all_own" on public.quiz_sets;
create policy "quiz_sets_all_own" on public.quiz_sets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "study_sessions_all_own" on public.study_sessions;
create policy "study_sessions_all_own" on public.study_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "review_events_all_own" on public.review_events;
create policy "review_events_all_own" on public.review_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Child tables via parent ownership.
drop policy if exists "study_flashcards_select_via_deck" on public.study_flashcards;
create policy "study_flashcards_select_via_deck" on public.study_flashcards for select using (
  exists (
    select 1 from public.study_decks d
    where d.id = study_flashcards.deck_id and d.user_id = auth.uid()
  )
);

drop policy if exists "study_flashcards_write_via_deck" on public.study_flashcards;
create policy "study_flashcards_write_via_deck" on public.study_flashcards for all
  using (
    exists (
      select 1 from public.study_decks d
      where d.id = study_flashcards.deck_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.study_decks d
      where d.id = study_flashcards.deck_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "quiz_questions_select_via_quiz_set" on public.quiz_questions;
create policy "quiz_questions_select_via_quiz_set" on public.quiz_questions for select using (
  exists (
    select 1 from public.quiz_sets s
    where s.id = quiz_questions.quiz_set_id and s.user_id = auth.uid()
  )
);

drop policy if exists "quiz_questions_write_via_quiz_set" on public.quiz_questions;
create policy "quiz_questions_write_via_quiz_set" on public.quiz_questions for all
  using (
    exists (
      select 1 from public.quiz_sets s
      where s.id = quiz_questions.quiz_set_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.quiz_sets s
      where s.id = quiz_questions.quiz_set_id and s.user_id = auth.uid()
    )
  );
