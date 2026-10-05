import type { MeasurementEvent } from './measurement';

export function measure(event: MeasurementEvent): void {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'true') return;
  void fetch('/api/measurement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {});
}
