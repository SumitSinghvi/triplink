// Self-check: node src/lib/chatMerge.check.mjs
import assert from 'node:assert/strict';
import { mergeChat, countNewIncoming } from './chatMerge.ts';

const s1 = { id: 'a', from: 'them', text: 'hi' };
const s2 = { id: 'b', from: 'me', text: 'yo' };
const pending = { id: 'c', from: 'me', text: 'sending', status: 'pending' };
const failed = { id: 'd', from: 'me', text: 'lost', status: 'failed' };
const ackedPending = { id: 'b', from: 'me', text: 'yo', status: 'pending' };

// Unsynced local messages survive a poll; acked ones are not duplicated.
assert.deepEqual(mergeChat([s1, s2], [s1, ackedPending, pending, failed]), [s1, s2, pending, failed]);
// Sent local messages (no status) are replaced by server history.
assert.deepEqual(mergeChat([s1], [s1, { id: 'x', from: 'me', text: 'old' }]), [s1]);
// Unread detection counts only new messages from the other person.
assert.equal(countNewIncoming([s1], [s1, s2, { id: 'e', from: 'them', text: 'new' }]), 1);
assert.equal(countNewIncoming([], [s1]), 1);
console.log('chatMerge: ok');
