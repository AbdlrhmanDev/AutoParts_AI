import { pool } from './pool.js';

const SCHEMA = `
create table if not exists settings (
  id         int primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists conversations (
  id         text primary key,
  title      text not null default '',
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists vehicles (
  id       serial primary key,
  position int not null,
  make text, model text, year int, engine text, trim text, market text, vin text
);
create table if not exists products (
  id           text primary key,
  url          text,
  title        text,
  price        numeric(12,2),
  seller       text,
  part_type    text,
  data         jsonb not null,
  retrieved_at timestamptz not null
);
create table if not exists quotations (
  no         text primary key,
  created_at timestamptz not null,
  total      numeric(12,2) not null,
  item_count int not null,
  vehicle    jsonb,
  data       jsonb not null
);
create table if not exists agent_runs (
  id          text primary key,
  thread_id   text not null,
  status      text not null,
  input       jsonb not null,
  output      jsonb,
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create table if not exists agent_events (
  id          bigserial primary key,
  run_id      text not null references agent_runs(id) on delete cascade,
  sequence    int not null,
  event_type  text not null,
  node_id     text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  unique (run_id, sequence)
);
create index if not exists agent_events_run_idx on agent_events(run_id, sequence);

create table if not exists browser_sessions (
  id          uuid primary key,
  token_hash  char(64) not null unique,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists browser_sessions_last_seen_idx on browser_sessions(last_seen_at);
create table if not exists user_settings (
  owner_id uuid primary key references browser_sessions(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists user_conversations (
  owner_id uuid not null references browser_sessions(id) on delete cascade,
  id text not null,
  title text not null default '',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
create index if not exists user_conversations_recent_idx on user_conversations(owner_id, created_at desc);
create table if not exists conversation_memory (
  owner_id uuid not null references browser_sessions(id) on delete cascade,
  conversation_id text not null,
  summary text not null default '',
  facts jsonb not null default '{}'::jsonb,
  summarized_message_count int not null default 0,
  source_token_estimate int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_id, conversation_id)
);
create index if not exists conversation_memory_updated_idx on conversation_memory(owner_id, updated_at desc);
create table if not exists user_vehicles (
  owner_id uuid not null references browser_sessions(id) on delete cascade,
  position int not null,
  make text, model text, year int, engine text, trim text, market text, vin text,
  primary key (owner_id, position)
);
create table if not exists user_products (
  owner_id uuid not null references browser_sessions(id) on delete cascade,
  id text not null,
  url text, title text, price numeric(12,2), seller text, part_type text,
  data jsonb not null,
  retrieved_at timestamptz not null,
  primary key (owner_id, id)
);
create index if not exists user_products_recent_idx on user_products(owner_id, retrieved_at desc);
create table if not exists user_quotations (
  owner_id uuid not null references browser_sessions(id) on delete cascade,
  no text not null,
  created_at timestamptz not null,
  total numeric(12,2) not null,
  item_count int not null,
  vehicle jsonb,
  data jsonb not null,
  primary key (owner_id, no)
);
create index if not exists user_quotations_recent_idx on user_quotations(owner_id, created_at desc);
alter table agent_runs add column if not exists owner_id uuid references browser_sessions(id) on delete cascade;
create index if not exists agent_runs_owner_idx on agent_runs(owner_id, started_at desc);
create table if not exists agent_rate_limits (
  owner_id uuid primary key references browser_sessions(id) on delete cascade,
  window_start timestamptz not null,
  request_count int not null
);
create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null,
  request_count int not null
);

-- Remove the retired simulated mode and its known fixture records.
update settings set data = data - 'mode' where data ? 'mode';
delete from conversations where data::text like '%demo-camry-pads%';
delete from quotations where data::text like '%demo-camry-pads%';
delete from products where data->>'source' = 'demo' or id = 'demo-camry-pads';
delete from agent_runs where input->>'mode' = 'demo';
`;

let migration: Promise<void> | null = null;

/** Creates the schema once. If the database was not up yet, the next call retries. */
export function ensureSchema(): Promise<void> {
  migration ??= pool.query(SCHEMA).then(
    () => undefined,
    err => {
      migration = null;
      throw err;
    },
  );
  return migration;
}
