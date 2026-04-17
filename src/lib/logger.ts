import fs from 'fs';
import path from 'path';

const LOG_DIR = process.env.VERCEL ? '/tmp/logs' : path.join(process.cwd(), 'logs');
const LOG_PATH = path.join(LOG_DIR, 'errors.log');

export function logError(
  endpoint: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
  const line = `[${timestamp}] ${endpoint} | ${message}${contextStr}\n`;

  // Non-blocking append — fire and forget with mkdir guard
  fs.mkdir(path.dirname(LOG_PATH), { recursive: true }, (mkdirErr) => {
    if (mkdirErr) {
      console.error('[logger] Failed to create logs directory:', mkdirErr);
      return;
    }
    fs.appendFile(LOG_PATH, line, (appendErr) => {
      if (appendErr) {
        console.error('[logger] Failed to append error log:', appendErr);
      }
    });
  });
}
