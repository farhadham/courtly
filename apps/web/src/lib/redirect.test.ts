import { describe, expect, it } from 'vitest';
import { safeRedirect } from './redirect';

describe('post-login redirect', () => {
  it('keeps an internal path and its query string', () => {
    expect(safeRedirect('/courts/abc?date=2030-01-15')).toBe('/courts/abc?date=2030-01-15');
  });

  it('falls back to the court list when nothing was requested', () => {
    expect(safeRedirect(undefined)).toBe('/');
    expect(safeRedirect('')).toBe('/');
  });

  it('refuses absolute and protocol-relative destinations', () => {
    expect(safeRedirect('https://evil.example')).toBe('/');
    expect(safeRedirect('//evil.example')).toBe('/');
  });

  it('refuses backslash paths that browsers treat as protocol-relative', () => {
    expect(safeRedirect('/\\evil.example')).toBe('/');
    expect(safeRedirect('/\\/evil.example')).toBe('/');
  });
});
