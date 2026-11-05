import test from 'node:test';
import assert from 'node:assert/strict';
import {recentlyVerified} from '../lib/session-policy.ts';

test('sensitive changes reject stale, future and invalid verification timestamps', () => {
  const now = 1800000000000;
  for (const verifiedAt of [0, -1, NaN, Infinity, '1800000000000', now + 1, now - 300000]) {
    assert.equal(recentlyVerified({verifiedAt}, now), false);
  }
  assert.equal(recentlyVerified({verifiedAt: now}, now), true);
  assert.equal(recentlyVerified({verifiedAt: now - 299999}, now), true);
});
