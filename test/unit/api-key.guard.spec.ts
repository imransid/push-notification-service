import { describe, expect, it } from 'vitest';
import { apiKeyMatches } from '../../src/notification/presentation/api-key.guard';

describe('apiKeyMatches', () => {
  it('the right key', () => {
    expect(apiKeyMatches('k-123', 'k-123')).toBe(true);
  });

  it('a wrong key, of any length', () => {
    expect(apiKeyMatches('k-124', 'k-123')).toBe(false);
    expect(apiKeyMatches('k', 'k-123')).toBe(false);
    expect(apiKeyMatches('k-123-and-more', 'k-123')).toBe(false);
  });

  it('no key sent, or none set on the server, refuses', () => {
    expect(apiKeyMatches(undefined, 'k-123')).toBe(false);
    expect(apiKeyMatches('k-123', undefined)).toBe(false);
    expect(apiKeyMatches('', '')).toBe(false);
  });
});
