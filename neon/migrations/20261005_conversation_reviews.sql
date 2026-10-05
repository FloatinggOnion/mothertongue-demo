create table if not exists public.conversation_reviews (
  id uuid primary key,
  delete_token_hash text not null unique,
  consent_version text not null,
  consented_at timestamptz not null,
  expires_at timestamptz not null,
  adult_confirmed boolean not null check (adult_confirmed),
  scenario_id text not null,
  language text not null check (language in ('yoruba', 'igbo', 'hausa')),
  proficiency_level text not null check (proficiency_level in ('beginner', 'intermediate', 'advanced')),
  messages jsonb not null,
  review_notes jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversation_reviews_expires_at_idx on public.conversation_reviews (expires_at);

-- The application uses a server-side Postgres connection string. Neon does not
-- create Supabase's anon/authenticated/service_role roles for this table.
revoke all on public.conversation_reviews from public;

comment on table public.conversation_reviews is 'Optional adult-consented text conversations for 30-day quality review. No audio or Clerk identity.';
