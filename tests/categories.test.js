import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryOf, statusOf, matchesTab, extensionOf, TABS } from '../lib/categories.js';

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
  assert.deepEqual(TABS, ['all', 'active', 'completed', 'image', 'video', 'audio', 'document', 'archive']);
});
