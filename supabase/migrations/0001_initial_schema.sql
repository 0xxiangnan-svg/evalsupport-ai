create extension if not exists vector;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  file_type text not null check (file_type in ('pdf', 'md', 'txt')),
  storage_path text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'indexing', 'indexed', 'failed')),
  chunk_count integer default 0,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  indexed_at timestamptz
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content text not null,
  page_number integer,
  position integer not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_document_id_idx
  on document_chunks(document_id);

create index if not exists document_chunks_embedding_idx
  on document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  status text not null check (status in ('answered', 'ticket_created', 'answer_anomaly', 'error')),
  top_similarity double precision,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists citations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  chunk_id uuid not null references document_chunks(id) on delete cascade,
  similarity double precision not null,
  snippet text not null,
  label text not null,
  created_at timestamptz not null default now()
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete set null,
  question text not null,
  trigger_reason text not null,
  ai_assessment text,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists eval_cases (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  expected_sources text[] not null default '{}',
  expected_behavior text not null check (expected_behavior in ('answer', 'refuse')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists eval_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'completed' check (status in ('running', 'completed', 'failed')),
  total_cases integer not null default 0,
  citation_accuracy double precision,
  refusal_accuracy double precision,
  answer_usability double precision,
  results jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_count int default 5,
  min_similarity double precision default 0.72
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_name text,
  content text,
  page_number integer,
  position integer,
  similarity double precision
)
language sql
stable
as $$
  select
    document_chunks.id as chunk_id,
    documents.id as document_id,
    documents.filename as document_name,
    document_chunks.content,
    document_chunks.page_number,
    document_chunks.position,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  join documents on documents.id = document_chunks.document_id
  where documents.status = 'indexed'
    and 1 - (document_chunks.embedding <=> query_embedding) >= min_similarity
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
