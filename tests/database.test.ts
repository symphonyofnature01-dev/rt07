import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresCurrentDatabase } from '../api/database.js';

test('only warga writes need a pre-read for ownership validation', () => {
  assert.equal(requiresCurrentDatabase({ role: 'Admin' }), false);
  assert.equal(requiresCurrentDatabase({ role: 'Ketua' }), false);
  assert.equal(requiresCurrentDatabase({ role: 'Bendahara' }), false);
  assert.equal(requiresCurrentDatabase({ role: 'Warga' }), true);
});
