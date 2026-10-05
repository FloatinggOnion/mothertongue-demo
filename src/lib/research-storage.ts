import 'server-only';
import { neon } from '@neondatabase/serverless';

export interface ReviewShareRow {
  id: string;
  delete_token_hash: string;
  consent_version: string;
  consented_at: string;
  expires_at: string;
  adult_confirmed: true;
  scenario_id: string;
  language: string;
  proficiency_level: string;
  messages: Array<{ role: 'user' | 'ai'; content: string }>;
}

function database() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    throw new Error('Neon database URL is missing');
  }
  return neon(url);
}

export async function insertReviewShare(row: ReviewShareRow): Promise<void> {
  const sql = database();
  await sql`
    insert into conversation_reviews
      (id, delete_token_hash, consent_version, consented_at, expires_at,
       adult_confirmed, scenario_id, language, proficiency_level, messages)
    values
      (${row.id}::uuid, ${row.delete_token_hash}, ${row.consent_version},
       ${row.consented_at}::timestamptz, ${row.expires_at}::timestamptz,
       ${row.adult_confirmed}, ${row.scenario_id}, ${row.language},
       ${row.proficiency_level}, ${JSON.stringify(row.messages)}::jsonb)
  `;
}

export async function deleteReviewShareByHash(hash: string): Promise<void> {
  const sql = database();
  await sql`delete from conversation_reviews where delete_token_hash = ${hash}`;
}

export async function deleteExpiredReviewShares(now: Date): Promise<void> {
  const sql = database();
  await sql`delete from conversation_reviews where expires_at <= ${now.toISOString()}::timestamptz`;
}
