import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeRows,mergeMessages,visiblePending,requestGate} from '../lib/conversation-state.ts';

test('live window rollover retains loaded history, applies tombstones, and orders by server sequence',()=>{
 const old=Array.from({length:50},(_,i)=>({id:String(i+1),seq:i+1,content:'old'}));
 const next=Array.from({length:50},(_,i)=>({id:String(i+3),seq:i+3,content:i===0?'': 'new',deleted_at:i===0?'deleted':null}));
 const rows=mergeMessages(old,next);
 assert.equal(rows.length,52);assert.deepEqual(rows.map(r=>r.seq),Array.from({length:52},(_,i)=>i+1));
 assert.equal(rows.find(r=>r.id==='3').deleted_at,'deleted');
 assert.equal(mergeMessages(rows,next).length,52);
});
test('pagination overlap and equal timestamps never duplicate or reorder rows nondeterministically',()=>{
 const rows=mergeMessages([{id:'b',created_at:'2026-10-28T00:00:00Z'}],[{id:'a',created_at:'2026-10-28T00:00:00Z'},{id:'b',created_at:'2026-10-28T00:00:00Z'}]);
 assert.deepEqual(rows.map(r=>r.id),['a','b']);assert.equal(mergeRows([{id:'file',bytes:1}],[{id:'file',bytes:2}])[0].bytes,2);
});
test('poll confirmation reconciles optimistic rows only for the matching author/client identity',()=>{
 const pending=[{id:'pending:k',client_id:'k',sender_id:'alice'}];
 assert.equal(visiblePending(pending,[{id:'server',client_id:'k',sender_id:'alice'}]).length,0);
 assert.equal(visiblePending(pending,[{id:'server',client_id:'k',sender_id:'bob'}]).length,1);
});
test('a delayed old response cannot replace a newer response or a different conversation',async()=>{
 const gate=requestGate();let resolveOld;const old=gate.begin();const delayed=new Promise(r=>resolveOld=r);let rendered='';
 const wait=delayed.then(()=>{if(old())rendered='old private channel'});
 const latest=gate.begin();assert(latest());rendered='new channel';resolveOld();await wait;assert.equal(rendered,'new channel');
 gate.invalidate();assert.equal(latest(),false);const unmounted=gate.begin();gate.invalidate();assert.equal(unmounted(),false);
});
