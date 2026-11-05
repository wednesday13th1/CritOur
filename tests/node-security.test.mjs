import test from 'node:test';
import assert from 'node:assert/strict';
import {isSupportedNode, assertSupportedNode} from '../scripts/node-security.mjs';

test('build runtime rejects vulnerable patches and unsupported release lines', () => {
  for (const version of ['22.23.3','24.22.0','26.12.0','20.20.0','23.99.0','25.99.0','27.0.0','22.23.4-rc.1','bad']) {
    assert.equal(isSupportedNode(version), false, version);
    assert.throws(() => assertSupportedNode(version), /supported patched release/);
  }
  for (const version of ['22.23.4','v22.23.4','22.24.0','24.22.1','24.23.0','26.12.1','26.13.0']) {
    assert.equal(isSupportedNode(version), true, version);
    assert.doesNotThrow(() => assertSupportedNode(version));
  }
});
