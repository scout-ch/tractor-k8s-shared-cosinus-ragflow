import assert from 'assert';
import { buildKey } from './pdf';

assert.strictEqual(
    buildKey('de', 'anker', ''),
    'de/anker.pdf',
    'key without prefix',
);
assert.strictEqual(
    buildKey('fr', 'anker', 'ragflow'),
    'ragflow/fr/anker.pdf',
    'key with prefix',
);

console.log('pdf.check.ts: OK');
