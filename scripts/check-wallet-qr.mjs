import assert from 'node:assert/strict';
import { create } from 'cuer/QrCode';

// Exercise RainbowKit's actual QR renderer dependency with a WalletConnect v2 URI.
// No relay request, session, wallet or private key is involved.
const uri = `wc:${'a'.repeat(64)}@2?relay-protocol=irn&symKey=${'b'.repeat(64)}`;
const qr = create(uri);
assert.equal(qr.value, uri);
assert(qr.edgeLength >= 21);
assert.equal(qr.grid.length, qr.edgeLength);
assert(qr.grid.every((row) => row.length === qr.edgeLength));
assert(qr.grid.flat().some(Boolean));
console.log('PASS: WalletConnect URI renders through RainbowKit QR dependency');
