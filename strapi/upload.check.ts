import assert from 'assert';
import { md5Hex, shouldSkipUpload } from './upload';

const buf = Buffer.from('hello world', 'utf8');
const md5 = md5Hex(buf);

assert.strictEqual(md5, '5eb63bbbe01eeed093cb22bb8f5acdc3', 'md5Hex must match known MD5 of "hello world"');
assert.strictEqual(shouldSkipUpload(md5, md5), true, 'matching etag must skip upload');
assert.strictEqual(shouldSkipUpload(md5, md5Hex(Buffer.from('other'))), false, 'different content must not skip upload');
assert.strictEqual(shouldSkipUpload(md5, null), false, 'no existing object (NotFound) must not skip upload');

console.log('upload.check.ts: OK');
