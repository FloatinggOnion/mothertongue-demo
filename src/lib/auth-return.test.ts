import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './auth-return';

describe('safeReturnPath', () => {
  it('keeps the local drill return path and query for a save after sign-in', () => {
    expect(safeReturnPath('/drill/market-haggling?save=1')).toBe('/drill/market-haggling?save=1');
  });

  it('does not redirect to another origin', () => {
    expect(safeReturnPath('//other.example/path')).toBe('/scenarios');
    expect(safeReturnPath('https://other.example/path')).toBe('/scenarios');
  });
});
