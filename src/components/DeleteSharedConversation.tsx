'use client';

import { useState } from 'react';

export function DeleteSharedConversation() {
  const [receipt, setReceipt] = useState('');
  const [status, setStatus] = useState<'idle' | 'deleting' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const remove = async () => {
    if (!receipt.trim() || status === 'deleting') return;
    setStatus('deleting');
    setError('');
    try {
      const response = await fetch('/api/review-shares', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receipt: receipt.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not delete the shared conversation');
      setStatus('done');
      setReceipt('');
    } catch (cause) {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'Could not delete the shared conversation');
    }
  };

  return (
    <div className="mt-4 max-w-xl">
      <label htmlFor="deletion-receipt" className="font-body text-sm text-text block mb-2">Deletion receipt</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input id="deletion-receipt" value={receipt} onChange={(event) => setReceipt(event.target.value)} className="flex-1 min-w-0 border border-divider bg-white p-3 font-mono text-xs text-text" autoComplete="off" />
        <button type="button" onClick={() => void remove()} disabled={!receipt.trim() || status === 'deleting'} className="bg-dark text-text-inverse px-5 py-3 font-ui text-xs uppercase tracking-widest disabled:opacity-50">
          {status === 'deleting' ? 'Deleting…' : 'Delete shared text'}
        </button>
      </div>
      {status === 'done' && <p role="status" className="font-body text-sm text-accent mt-3">Deletion request completed. The shared text linked to that receipt is no longer in our review store.</p>}
      {status === 'error' && <p role="alert" className="font-body text-sm text-red-700 mt-3">{error}</p>}
    </div>
  );
}
