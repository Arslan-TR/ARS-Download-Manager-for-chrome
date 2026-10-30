import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, toBps, fromBps, formatBytes, formatSpeed, formatEta, badgeText } from '../lib/units.js';

test('toBps converts each unit to bytes per second', () => {
  assert.equal(toBps(1, 'KBps'), 1024);
  assert.equal(toBps(2, 'MBps'), 2 * 1024 * 1024);
  assert.equal(toBps(8, 'Mbps'), 1_000_000);
});

test('fromBps is the inverse of toBps', () => {
  for (const unit of Object.keys(UNITS)) {
    assert.equal(fromBps(toBps(5, unit), unit), 5);
  }
});

test('toBps rejects invalid input', () => {
  assert.equal(toBps(-1, 'MBps'), null);
  assert.equal(toBps(NaN, 'MBps'), null);
  assert.equal(toBps(0, 'MBps'), null);
  assert.equal(toBps(1, 'nope'), null);
});

test('formatBytes picks a readable unit', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBytes(3.25 * 1024 ** 3), '3.25 GB');
  assert.equal(formatBytes(-1), '?');
});

test('formatSpeed appends /s', () => {
  assert.equal(formatSpeed(2 * 1024 * 1024), '2.0 MB/s');
});

test('formatEta renders h/m/s', () => {
  assert.equal(formatEta(5), '5s');
  assert.equal(formatEta(125), '2m 5s');
  assert.equal(formatEta(3725), '1h 2m');
  assert.equal(formatEta(Infinity), '∞');
  assert.equal(formatEta(NaN), '∞');
});

test('badgeText is short enough for the toolbar badge', () => {
  assert.equal(badgeText(2 * 1024 * 1024), '2M');
  assert.equal(badgeText(1.5 * 1024 * 1024), '1.5M');
  assert.equal(badgeText(500 * 1024), '500K');
  assert.equal(badgeText(12 * 1024 * 1024), '12M');
  for (const v of [1, 1024, 999 * 1024, 123 * 1024 * 1024]) {
    assert.ok(badgeText(v).length <= 4, `${badgeText(v)} too long`);
  }
});

test('formatEta takes localized patterns', () => {
  const tr = { h: (h, m) => `${h} sa ${m} dk`, m: (m, s) => `${m} dk ${s} sn`, s: (s) => `${s} sn` };
  assert.equal(formatEta(102, tr), '1 dk 42 sn');
  assert.equal(formatEta(3725, tr), '1 sa 2 dk');
  assert.equal(formatEta(9, tr), '9 sn');
  assert.equal(formatEta(Infinity, tr), '∞');
});
