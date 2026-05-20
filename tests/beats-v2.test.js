import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createThread, currentBeat, advance,
  pushSubThread, subThreadDepth
} from '../src/beats/thread.js';

const beat = (id, opts = {}) => ({
  id,
  dramaticPurpose: id,
  targetPlaytimeMinutes: 10,
  prerequisites: opts.prerequisites ?? [],
  setRequiredFlags: opts.setRequiredFlags ?? [`done.${id}`],
  successors: opts.successors ?? []
});

// === Branching threads

test('advance picks the first ready successor by default', () => {
  const start = beat('start', { successors: ['left', 'right'] });
  const left = beat('left',  { prerequisites: ['went.left'] });
  const right = beat('right',{ prerequisites: ['went.right'] });
  const thread = createThread([start, left, right]);

  const state = { flags: { 'done.start': true, 'went.right': true } };
  const r = advance(thread, state);
  assert.equal(r.advanced, true);
  assert.equal(currentBeat(r.thread).id, 'right');
});

test('advance honours chooseSuccessor when supplied', () => {
  const start = beat('start', { successors: ['left', 'right'] });
  const left = beat('left',  { prerequisites: ['choice.made'] });
  const right = beat('right',{ prerequisites: ['choice.made'] });
  const thread = createThread([start, left, right]);

  const state = { flags: { 'done.start': true, 'choice.made': true } };
  const r = advance(thread, state, {
    chooseSuccessor: ({ candidates }) => candidates.find(id => id === 'left')
  });
  assert.equal(r.advanced, true);
  assert.equal(currentBeat(r.thread).id, 'left');
});

test('advance reports no ready successor when prereqs unmet', () => {
  const start = beat('start', { successors: ['left', 'right'] });
  const left = beat('left',   { prerequisites: ['went.left'] });
  const right = beat('right', { prerequisites: ['went.right'] });
  const thread = createThread([start, left, right]);
  const state = { flags: { 'done.start': true } };
  const r = advance(thread, state);
  assert.equal(r.advanced, false);
  assert.match(r.reason, /no ready successor/);
});

test('advance reports unknown-id when chooseSuccessor returns something unmapped', () => {
  const start = beat('start', { successors: ['left'] });
  const left = beat('left');
  const thread = createThread([start, left]);
  const state = { flags: { 'done.start': true } };
  const r = advance(thread, state, { chooseSuccessor: () => 'phantom' });
  assert.equal(r.advanced, false);
  assert.match(r.reason, /unknown id: phantom/);
});

test('advance falls back to linear when successors[] is empty', () => {
  const a = beat('a');
  const b = beat('b');
  const thread = createThread([a, b]);
  const r = advance(thread, { flags: { 'done.a': true } });
  assert.equal(r.advanced, true);
  assert.equal(currentBeat(r.thread).id, 'b');
});

test('advance reports finished:true on linear past the last beat', () => {
  const a = beat('a');
  const thread = createThread([a]);
  const r = advance(thread, { flags: { 'done.a': true } });
  assert.equal(r.finished, true);
});

test('advance filters successors that reference unknown ids', () => {
  const start = beat('start', { successors: ['left', 'phantom'] });
  const left = beat('left');
  const thread = createThread([start, left]);
  const r = advance(thread, { flags: { 'done.start': true } });
  assert.equal(currentBeat(r.thread).id, 'left');
});

// === Sub-threads (nested)

test('pushSubThread adds a layer to the stack', () => {
  const main = createThread([beat('a'), beat('b')]);
  const withSub = pushSubThread(main, [beat('sub-a'), beat('sub-b')]);
  assert.equal(subThreadDepth(withSub), 1);
  assert.equal(currentBeat(withSub).id, 'sub-a');
});

test('advance walks the sub-thread while it is active', () => {
  let t = pushSubThread(createThread([beat('a'), beat('b')]), [beat('sub-a'), beat('sub-b')]);
  // Sub-a complete → advance to sub-b
  const r = advance(t, { flags: { 'done.sub-a': true } });
  assert.equal(r.advanced, true);
  assert.equal(currentBeat(r.thread).id, 'sub-b');
});

test('sub-thread completion pops the stack and returns to parent', () => {
  let t = pushSubThread(createThread([beat('a'), beat('b')]), [beat('sub-a')]);
  // Complete sub-a — this is the only sub beat, so the sub-thread
  // finishes and the stack pops. The parent's current beat is 'a'.
  const r = advance(t, { flags: { 'done.sub-a': true } });
  assert.equal(subThreadDepth(r.thread), 0);
  assert.equal(currentBeat(r.thread).id, 'a');
});

test('sub-threads stack multiple levels deep', () => {
  let t = createThread([beat('root')]);
  t = pushSubThread(t, [beat('s1')]);
  t = pushSubThread(t, [beat('s2')]);
  assert.equal(subThreadDepth(t), 2);
  assert.equal(currentBeat(t).id, 's2');
});

test('createThread is backward-compatible — no successors needed', () => {
  const a = beat('a');
  const b = beat('b');
  const thread = createThread([a, b]);
  assert.equal(thread.currentIndex, 0);
  assert.deepEqual(thread.stack, []);
  assert.equal(thread.byId.a, 0);
  assert.equal(thread.byId.b, 1);
});
