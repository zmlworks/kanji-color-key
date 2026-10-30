import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const kck = (args, input) => spawnSync(process.execPath, ['bin/kck.js', ...args], { input, encoding: 'utf8' });

test('cli: invalid --bits / --check are rejected instead of producing an empty key', () => {
  for (const a of [['--bits', 'abc'], ['--bits', '0'], ['--bits', '1.5'], ['--check', 'x']]) {
    const r = kck(['random', ...a]);
    assert.equal(r.status, 1, a.join(' ')); assert.match(r.stderr, /must be an integer/); assert.equal(r.stdout, '');
  }
  const ok = kck(['random', '--bits', '64']);
  assert.equal(ok.status, 0); assert.match(ok.stdout.split('\n')[0], /^[0-9a-f]{16}$/);
});
test('cli: hash reads the passphrase from stdin; the argument form still works but warns', () => {
  const piped = kck(['hash', '--salt', 'me', '--iter', '1000'], 'test\n');
  const arg = kck(['hash', 'test', '--salt', 'me', '--iter', '1000']);
  assert.equal(piped.status, 0); assert.equal(arg.status, 0);
  assert.equal(piped.stdout, arg.stdout);
  assert.doesNotMatch(piped.stderr, /warning/); assert.match(arg.stderr, /warning: a passphrase given on the command line/);
});
