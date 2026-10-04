const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function harness({ imageReplies = [], response = {} } = {}) {
  let time = 0;
  let sequence = 0;
  const timers = new Map();
  const requests = [];
  const images = [];
  let active = 0;
  let maxActive = 0;
  function schedule(fn, delay, interval = 0) {
    const id = ++sequence;
    timers.set(id, { at: time + delay, fn, interval });
    return id;
  }
  function advance(ms) {
    const end = time + ms;
    let iterations = 0;
    while (true) {
      let next;
      for (const [id, timer] of timers) {
        if (timer.at <= end && (!next || timer.at < next[1].at)) next = [id, timer];
      }
      if (!next) break;
      if (++iterations > 10000) throw new Error('Runaway timers');
      time = next[1].at;
      timers.delete(next[0]);
      if (next[1].interval) timers.set(next[0], { ...next[1], at: time + next[1].interval });
      next[1].fn();
    }
    time = end;
  }
  class FakeImage {
    set src(url) {
      if (this.timer) timers.delete(this.timer);
      if (!url) return;
      images.push(url);
      const reply = imageReplies.shift();
      if (reply && reply.kind !== 'never') {
        this.timer = schedule(() => {
          const callback = reply.kind === 'ok' ? this.onload : this.onerror;
          if (callback) callback();
        }, reply.delay);
      }
    }
  }
  class FakeXHR {
    open(method, url) {
      const params = new URL(url).searchParams;
      this.size = params.has('ckSize') ? Number(params.get('ckSize')) * 1048576 : Number(params.get('bytes'));
      this.url = url;
    }
    getResponseHeader(name) {
      if (name === 'Content-Type') return response.type || 'application/octet-stream';
      if (name === 'Content-Length') return response.headerSize === null ? null : String(response.headerSize || this.size);
      return null;
    }
    send() {
      requests.push(this);
      this.live = true;
      this.aborted = false;
      active++;
      maxActive = Math.max(maxActive, active);
      const delay = response.delay || 600;
      schedule(() => {
        if (!this.live) return;
        this.readyState = 2;
        this.status = response.status || 200;
        if (this.onreadystatechange) this.onreadystatechange();
      }, 1);
      if (response.never) return;
      schedule(() => {
        if (this.live && this.onprogress) this.onprogress({ loaded: response.oversize ? this.size + 1 : this.size / 2 });
      }, delay / 2);
      schedule(() => {
        if (!this.live) return;
        this.live = false;
        active--;
        this.response = { byteLength: response.bodySize || this.size };
        if (this.onload) this.onload();
      }, delay);
    }
    abort() {
      if (this.live) { this.live = false; active--; }
      this.aborted = true;
    }
  }
  const context = {
    Image: FakeImage, XMLHttpRequest: FakeXHR, performance: { now: () => time },
    setTimeout: (fn, delay) => schedule(fn, delay), clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, delay), clearInterval: id => timers.delete(id)
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/js/engine.js'), 'utf8'), context);
  return { engine: context.NetEngine, advance, requests, images, get active() { return active; }, get maxActive() { return maxActive; } };
}
const server = { url: 'https://test.example/down' };
const options = { timeoutMs: 3000, durationMs: 10000, budgetBytes: 2 * 1048576 };

test('site probes return a median and variation without reusing the resource URL', () => {
  const h = harness({ imageReplies: [40, 100, 70].map(delay => ({ kind: 'ok', delay })) });
  let result;
  h.engine.probe('https://test.example/favicon.ico', { timeoutMs: 3000, samples: 3 }, () => {}, value => result = value);
  h.advance(1000);
  assert.equal(result.reason, 'ok');
  assert.equal(result.ms, 70);
  assert.equal(result.spread, 45);
  assert.equal(result.requested, 3);
  assert.equal(new Set(h.images).size, 3);
});

test('a later probe failure preserves the successful sample and requested count', () => {
  const h = harness({ imageReplies: [{ kind: 'ok', delay: 40 }, { kind: 'resource', delay: 50 }] });
  let result;
  h.engine.probe('https://test.example/favicon.ico', { timeoutMs: 3000, samples: 5 }, () => {}, value => result = value);
  h.advance(10000);
  assert.equal(result.reason, 'resource');
  assert.equal(result.ms, 40);
  assert.equal(result.samples.length, 1);
  assert.equal(result.requested, 5);
  assert.equal(h.images.length, 2);
});

test('a failed or timed out site stops further probes', () => {
  for (const kind of ['resource', 'never']) {
    const h = harness({ imageReplies: [{ kind, delay: 50 }] });
    let result;
    h.engine.probe('https://test.example/favicon.ico', { timeoutMs: 3000, samples: 5 }, () => {}, value => result = value);
    h.advance(10000);
    assert.equal(result.reason, kind === 'never' ? 'timeout' : 'resource');
    assert.equal(result.ms, null);
    assert.equal(h.images.length, 1);
  }
});

test('cancelled site probes emit one result and never continue', () => {
  const h = harness({ imageReplies: [{ kind: 'ok', delay: 800 }] });
  const results = [];
  const control = h.engine.probe('https://test.example/favicon.ico', { timeoutMs: 3000, samples: 3 }, () => {}, value => results.push(value));
  control.cancel(); control.cancel(); h.advance(10000);
  assert.equal(results.length, 1);
  assert.equal(results[0].reason, 'cancelled');
  assert.equal(h.images.length, 1);
});

test('download stays within the traffic budget and two finite bodies', () => {
  for (const response of [{ delay: 600 }, { delay: 100, headerSize: null }]) {
    const h = harness({ response });
    let result;
    const ticks = [];
    h.engine.download(server, options, state => ticks.push(state), value => result = value);
    h.advance(10000);
    assert.equal(result.reason, 'budget');
    assert.equal(result.bytes, options.budgetBytes);
    assert.equal(h.requests.reduce((total, request) => total + request.size, 0), options.budgetBytes);
    assert.ok(h.requests.every(request => request.size <= 1048576 && request.responseType === 'arraybuffer'));
    assert.equal(h.maxActive, 2);
    assert.equal(h.active, 0);
    assert.ok(h.requests.every(request => request.aborted));
    assert.equal(result.mbps, result.bytes * 8 / result.elapsedMs / 1000);
    if (response.delay < 350) assert.ok(h.requests.some(request => request.size === 1048576));
    let previous = { bytes: 0, elapsedMs: 0 };
    for (const tick of ticks) {
      assert.equal(tick.intervalMbps, (tick.bytes - previous.bytes) * 8 / (tick.elapsedMs - previous.elapsedMs) / 1000);
      previous = tick;
    }
    if (response.delay === 600) assert.ok(ticks.some(tick => tick.intervalMbps !== tick.mbps));
  }
});

test('deadline and cancellation abort active transfers and prevent new requests', () => {
  for (const cancelled of [false, true]) {
    const h = harness({ response: { delay: 4000 } });
    const results = [];
    const control = h.engine.download(server, { ...options, durationMs: 1000 }, () => {}, value => results.push(value));
    if (cancelled) { h.advance(500); control.cancel(); control.cancel(); }
    h.advance(20000);
    assert.equal(results.length, 1);
    assert.equal(results[0].reason, cancelled ? 'cancelled' : 'duration');
    assert.equal(h.requests.length, 2);
    assert.equal(h.active, 0);
    assert.ok(h.requests.every(request => request.aborted));
  }
});

test('LibreSpeed uses finite one-MiB requests within the same budget', () => {
  const h = harness({ response: { delay: 2000, headerSize: null } });
  let result;
  h.engine.download({ url: 'https://test.example/garbage', librespeed: true }, options, () => {}, value => result = value);
  h.advance(10000);
  assert.equal(result.reason, 'budget');
  assert.equal(result.bytes, options.budgetBytes);
  assert.equal(h.maxActive, 2);
  assert.equal(h.active, 0);
  assert.ok(h.requests.every(request => new URL(request.url).searchParams.get('ckSize') === '1'));
  assert.equal(h.requests.reduce((total, request) => total + request.size, 0), options.budgetBytes);
});

test('no-progress transfers stop after the response timeout', () => {
  const h = harness({ response: { never: true } });
  let result;
  h.engine.download(server, options, () => {}, value => result = value);
  h.advance(4000);
  assert.equal(result.reason, 'timeout');
  assert.ok(result.elapsedMs <= 3001);
  assert.equal(result.bytes, 0);
  assert.equal(h.active, 0);
});

test('HTTP errors, HTML, wrong lengths and oversized progress cannot become a speed result', () => {
  for (const response of [{ status: 403 }, { type: 'text/html' }, { headerSize: 123 }, { bodySize: 123 }, { oversize: true }]) {
    const h = harness({ response });
    let result;
    h.engine.download(server, options, () => {}, value => result = value);
    h.advance(10000);
    assert.equal(result.reason, response.status ? 'http' : 'payload');
    assert.equal(result.complete, 0);
    assert.equal(h.active, 0);
  }
});
