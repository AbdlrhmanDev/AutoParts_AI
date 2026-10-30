import { pool } from '../db/pool.js';
import type { Listing, QuotationRecord, Vehicle } from '../types.js';

// Every customer-data query requires ownerId. There is no unscoped read path.
export const settingsRepo = {
  async get(ownerId: string): Promise<Record<string, unknown> | null> {
    const { rows } = await pool.query('select data from user_settings where owner_id=$1', [ownerId]);
    return rows[0]?.data ?? null;
  },
  async save(ownerId: string, data: Record<string, unknown>) {
    await pool.query(
      `insert into user_settings (owner_id,data) values ($1,$2)
       on conflict (owner_id) do update set data=excluded.data,updated_at=now()`,
      [ownerId, data],
    );
  },
};

export const conversationsRepo = {
  async listIds(ownerId: string): Promise<string[]> {
    const { rows } = await pool.query('select id from user_conversations where owner_id=$1', [ownerId]);
    return rows.map(row => String(row.id));
  },
  async listRecent(ownerId: string, limit = 20): Promise<unknown[]> {
    const { rows } = await pool.query('select data from user_conversations where owner_id=$1 order by created_at desc limit $2', [ownerId, limit]);
    return rows.map(row => row.data);
  },
  async upsert(ownerId: string, id: string, title: string, createdAt: number, data: unknown) {
    await pool.query(
      `insert into user_conversations (owner_id,id,title,data,created_at) values ($1,$2,$3,$4,to_timestamp($5/1000.0))
       on conflict (owner_id,id) do update set title=excluded.title,data=excluded.data,updated_at=now()`,
      [ownerId, id, title, data, createdAt],
    );
  },
  async get(ownerId: string, id: string): Promise<any | null> {
    const { rows } = await pool.query('select data from user_conversations where owner_id=$1 and id=$2', [ownerId, id]);
    return rows[0]?.data ?? null;
  },
};

export interface StoredConversationMemory {
  summary: string;
  facts: Record<string, unknown>;
  summarizedMessageCount: number;
  sourceTokenEstimate: number;
}

export const conversationMemoryRepo = {
  async get(ownerId: string, conversationId: string): Promise<StoredConversationMemory | null> {
    const { rows } = await pool.query(
      'select summary,facts,summarized_message_count,source_token_estimate from conversation_memory where owner_id=$1 and conversation_id=$2',
      [ownerId, conversationId],
    );
    const row = rows[0];
    return row ? { summary: row.summary, facts: row.facts ?? {}, summarizedMessageCount: Number(row.summarized_message_count), sourceTokenEstimate: Number(row.source_token_estimate) } : null;
  },
  async upsert(ownerId: string, conversationId: string, memory: StoredConversationMemory) {
    await pool.query(
      `insert into conversation_memory (owner_id,conversation_id,summary,facts,summarized_message_count,source_token_estimate)
       values ($1,$2,$3,$4,$5,$6)
       on conflict (owner_id,conversation_id) do update set summary=excluded.summary,facts=excluded.facts,
         summarized_message_count=excluded.summarized_message_count,source_token_estimate=excluded.source_token_estimate,updated_at=now()`,
      [ownerId, conversationId, memory.summary, memory.facts, memory.summarizedMessageCount, memory.sourceTokenEstimate],
    );
  },
  async delete(ownerId: string, conversationId: string) {
    const { rowCount } = await pool.query('delete from conversation_memory where owner_id=$1 and conversation_id=$2', [ownerId, conversationId]);
    return (rowCount ?? 0) > 0;
  },
};

export const vehiclesRepo = {
  async list(ownerId: string): Promise<Vehicle[]> {
    const { rows } = await pool.query('select make,model,year,engine,trim,market,vin from user_vehicles where owner_id=$1 order by position', [ownerId]);
    return rows.map(row => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null)) as Vehicle);
  },
  async replaceAll(ownerId: string, list: Vehicle[]) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from user_vehicles where owner_id=$1', [ownerId]);
      for (const [position, vehicle] of list.entries()) {
        await client.query(
          `insert into user_vehicles (owner_id,position,make,model,year,engine,trim,market,vin)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [ownerId, position, vehicle.make ?? null, vehicle.model ?? null, vehicle.year ?? null, vehicle.engine ?? null, vehicle.trim ?? null, vehicle.market ?? null, vehicle.vin ?? null],
        );
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  },
};

export const productsRepo = {
  async listRecent(ownerId: string, limit = 500): Promise<Listing[]> {
    const { rows } = await pool.query('select data from user_products where owner_id=$1 order by retrieved_at desc limit $2', [ownerId, limit]);
    return rows.map(row => row.data);
  },
  async upsertMany(ownerId: string, products: Listing[]) {
    for (const product of products) {
      await pool.query(
        `insert into user_products (owner_id,id,url,title,price,seller,part_type,data,retrieved_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (owner_id,id) do update set title=excluded.title,price=excluded.price,seller=excluded.seller,
           data=excluded.data,retrieved_at=excluded.retrieved_at`,
        [ownerId, product.id, product.url, product.en, product.price, product.seller.en, product.type, product, product.retrievedAt],
      );
    }
  },
};

export const quotationsRepo = {
  async listRecent(ownerId: string, limit = 10) {
    const { rows } = await pool.query(
      'select no,created_at,total,item_count,vehicle,data from user_quotations where owner_id=$1 order by created_at desc limit $2',
      [ownerId, limit],
    );
    return rows.map(row => ({ no: row.no, date: row.created_at, expiresAt: row.data?.expiresAt ?? null, totalN: Number(row.total), count: row.item_count, vehicle: row.vehicle ?? {} }));
  },
  async insert(ownerId: string, quotation: QuotationRecord) {
    await pool.query(
      `insert into user_quotations (owner_id,no,created_at,total,item_count,vehicle,data)
       values ($1,$2,$3,$4,$5,$6,$7) on conflict (owner_id,no) do nothing`,
      [ownerId, quotation.no, quotation.date ?? new Date().toISOString(), quotation.totalN ?? 0, quotation.count ?? 0, quotation.vehicle ?? {}, quotation],
    );
  },
  async get(ownerId: string, no: string): Promise<QuotationRecord | null> {
    const { rows } = await pool.query('select data from user_quotations where owner_id=$1 and no=$2', [ownerId, no]);
    return rows[0]?.data ?? null;
  },
};

export const agentRunsRepo = {
  async create(ownerId: string, id: string, threadId: string, input: unknown) {
    await pool.query('insert into agent_runs (id,owner_id,thread_id,status,input) values ($1,$2,$3,$4,$5)', [id, ownerId, threadId, 'queued', input]);
  },
  async recoverInterrupted() {
    const { rowCount } = await pool.query("update agent_runs set status='queued',error=null,finished_at=null where status='running' and owner_id is not null");
    return rowCount ?? 0;
  },
  async claimNext() {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(
        `select id,owner_id,thread_id,input from agent_runs
         where status='queued' and owner_id is not null order by started_at for update skip locked limit 1`,
      );
      const run = rows[0];
      if (!run) { await client.query('commit'); return null; }
      await client.query("update agent_runs set status='running',started_at=now(),error=null where id=$1", [run.id]);
      await client.query('commit');
      return run as { id: string; owner_id: string; thread_id: string; input: any };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  },
  async maxEventSequence(id: string) {
    const { rows } = await pool.query('select coalesce(max(sequence),0)::int as sequence from agent_events where run_id=$1', [id]);
    return Number(rows[0]?.sequence ?? 0);
  },
  async addEvent(runId: string, sequence: number, type: string, nodeId: string | null, data: unknown) {
    await pool.query(
      'insert into agent_events (run_id,sequence,event_type,node_id,data) values ($1,$2,$3,$4,$5) on conflict do nothing',
      [runId, sequence, type, nodeId, data],
    );
  },
  async complete(ownerId: string, id: string, output: unknown) {
    await pool.query("update agent_runs set status='completed',output=$3,finished_at=now() where id=$1 and owner_id=$2 and status='running'", [id, ownerId, output]);
  },
  async fail(ownerId: string, id: string, error: string) {
    await pool.query("update agent_runs set status='failed',error=$3,finished_at=now() where id=$1 and owner_id=$2 and status='running'", [id, ownerId, error]);
  },
  async cancel(ownerId: string, id: string) {
    const { rowCount } = await pool.query(
      "update agent_runs set status='cancelled',error='Cancelled by user',finished_at=now() where id=$1 and owner_id=$2 and status in ('queued','running')",
      [id, ownerId],
    );
    return (rowCount ?? 0) > 0;
  },
  async get(ownerId: string, id: string) {
    const { rows } = await pool.query(
      'select id,thread_id,status,error,started_at,finished_at from agent_runs where id=$1 and owner_id=$2',
      [id, ownerId],
    );
    return rows[0] ?? null;
  },
  async listEvents(ownerId: string, runId: string, afterSequence = 0) {
    const { rows } = await pool.query(
      `select e.sequence,e.data from agent_events e
       join agent_runs r on r.id=e.run_id
       where e.run_id=$1 and r.owner_id=$2 and e.sequence>$3 order by e.sequence`,
      [runId, ownerId, afterSequence],
    );
    return rows.map(row => row.data);
  },
};

/**
 * Removes sessions no browser can present any more (cookie unused for a year) and
 * idle sessions that never stored anything (bots, one-off visits). Owned rows cascade.
 */
export async function pruneSessions() {
  const { rowCount } = await pool.query(
    `delete from browser_sessions s where s.last_seen_at < now() - interval '365 days'
       or (s.last_seen_at < now() - interval '7 days'
           and not exists (select 1 from user_settings where owner_id=s.id)
           and not exists (select 1 from user_conversations where owner_id=s.id)
           and not exists (select 1 from user_vehicles where owner_id=s.id)
           and not exists (select 1 from user_quotations where owner_id=s.id)
           and not exists (select 1 from user_products where owner_id=s.id)
           and not exists (select 1 from agent_runs where owner_id=s.id))`,
  );
  return rowCount ?? 0;
}

export async function deleteAllData(ownerId: string) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from user_settings where owner_id=$1', [ownerId]);
    await client.query('delete from user_conversations where owner_id=$1', [ownerId]);
    await client.query('delete from conversation_memory where owner_id=$1', [ownerId]);
    await client.query('delete from user_vehicles where owner_id=$1', [ownerId]);
    await client.query('delete from user_products where owner_id=$1', [ownerId]);
    await client.query('delete from user_quotations where owner_id=$1', [ownerId]);
    await client.query('delete from agent_runs where owner_id=$1', [ownerId]);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
