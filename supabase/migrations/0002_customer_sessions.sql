create table if not exists customer_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table conversations
  add column if not exists session_id uuid references customer_sessions(id) on delete set null;

alter table tickets
  add column if not exists session_id uuid references customer_sessions(id) on delete set null;

create index if not exists customer_sessions_token_hash_idx
  on customer_sessions(token_hash);

create index if not exists conversations_session_id_idx
  on conversations(session_id);

create index if not exists tickets_session_id_idx
  on tickets(session_id);

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('knowledge-base', 'knowledge-base', false)
    on conflict (id) do nothing;
  end if;
end $$;
