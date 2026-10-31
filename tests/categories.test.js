import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryOf, statusOf, matchesTab, extensionOf, sortDownloads, TABS, MORE_FILTERS } from '../lib/categories.js';

test('extensionOf reads the last extension of the file name', () => {
  assert.equal(extensionOf('C:\\Users\\a\\Downloads\\Adele - Hello.MP4'), 'mp4');
  assert.equal(extensionOf('/home/a/archive.tar.gz'), 'gz');
  assert.equal(extensionOf('/home/a/README'), '');
  assert.equal(extensionOf(''), '');
});

test('categoryOf uses the extension first, then the MIME type', () => {
  assert.equal(categoryOf({ filename: 'Top Gear.mp4' }), 'video');
  assert.equal(categoryOf({ filename: 'song.flac' }), 'audio');
  assert.equal(categoryOf({ filename: 'photo.JPEG' }), 'image');
  assert.equal(categoryOf({ filename: 'report.pdf' }), 'document');
  assert.equal(categoryOf({ filename: 'ubuntu.iso' }), 'archive');
  assert.equal(categoryOf({ filename: 'setup.exe' }), 'program');
  assert.equal(categoryOf({ filename: 'noext', mime: 'video/webm' }), 'video');
  assert.equal(categoryOf({ filename: 'noext', mime: 'application/octet-stream' }), 'other');
});

test('statusOf maps Chrome states to list statuses', () => {
  assert.equal(statusOf({ state: 'in_progress', paused: false }), 'active');
  assert.equal(statusOf({ state: 'in_progress', paused: true }), 'paused');
  assert.equal(statusOf({ state: 'complete', exists: true }), 'complete');
  assert.equal(statusOf({ state: 'complete', exists: false }), 'missing');
  assert.equal(statusOf({ state: 'interrupted', error: 'USER_CANCELED' }), 'canceled');
  assert.equal(statusOf({ state: 'interrupted', error: 'NETWORK_FAILED' }), 'failed');
});

test('matchesTab filters by status and category', () => {
  const video = { state: 'complete', exists: true, filename: 'a.mp4' };
  const active = { state: 'in_progress', paused: true, filename: 'b.zip' };
  assert.ok(matchesTab(video, 'all'));
  assert.ok(matchesTab(video, 'completed'));
  assert.ok(matchesTab(video, 'video'));
  assert.ok(!matchesTab(video, 'active'));
  assert.ok(matchesTab(active, 'active'));
  assert.ok(matchesTab(active, 'archive'));
  assert.ok(!matchesTab(active, 'completed'));
  assert.deepEqual(TABS, ['all', 'active', 'completed', 'image', 'video', 'audio', 'document']);
});

test('extra filters cover programs, other files and failed downloads', () => {
  assert.deepEqual(MORE_FILTERS, ['archive', 'program', 'other', 'failed']);
  assert.ok(matchesTab({ state: 'complete', exists: true, filename: 'setup.exe' }, 'program'));
  assert.ok(matchesTab({ state: 'complete', exists: true, filename: 'README' }, 'other'));
  assert.ok(matchesTab({ state: 'interrupted', error: 'USER_CANCELED', filename: 'a.zip' }, 'failed'));
  assert.ok(matchesTab({ state: 'interrupted', error: 'NETWORK_FAILED', filename: 'a.zip' }, 'failed'));
  assert.ok(!matchesTab({ state: 'complete', exists: true, filename: 'a.zip' }, 'failed'));
});

test('sortDownloads orders by name or size, both directions, keeping input order otherwise', () => {
  const list = [
    { id: 1, filename: '/d/beta.zip', fileSize: 30, totalBytes: 30 },
    { id: 2, filename: '/d/Alpha.mp4', fileSize: 10, totalBytes: 10 },
    { id: 3, filename: '/d/gamma.pdf', fileSize: 0, totalBytes: 20 },
  ];
  const ids = (l) => l.map((d) => d.id);
  assert.deepEqual(ids(sortDownloads(list, 'name', 'asc')), [2, 1, 3]);
  assert.deepEqual(ids(sortDownloads(list, 'name', 'desc')), [3, 1, 2]);
  assert.deepEqual(ids(sortDownloads(list, 'size', 'asc')), [2, 3, 1]);
  assert.deepEqual(ids(sortDownloads(list, 'size', 'desc')), [1, 3, 2]);
  assert.deepEqual(ids(sortDownloads(list, null, 'asc')), [1, 2, 3]);
  assert.deepEqual(ids(list), [1, 2, 3], 'input is not mutated');
});
