const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { Uint8Array };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/js/doh-engine.js'), 'utf8'), context);
const engine = context.NetDoH;
function response(q) {
    const b = Buffer.concat([Buffer.from(q), Buffer.from([192,12,0,1,0,1,0,0,0,60,0,4,93,184,215,14])]);
    b[2] = 129; b[3] = 128; b[7] = 1;
    return b;
}
function buffer(b) { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
test('DoH validates the matching question and usable A answer', () => {
    const q = engine.query();
    assert.equal(engine.validate(buffer(response(q)), q), null);
    for (const edit of [b => b[0] ^= 1, b => b[3] = 131, b => b[7] = 0, b => b[b.length-4] = 0, b => b[2] |= 2, b => b[12] = 255]) {
        const b = response(q); edit(b);
        assert.notEqual(engine.validate(buffer(b), q), null);
    }
    assert.equal(engine.validate(new ArrayBuffer(5), q), 'dnsInvalid');
});

test('DoH preserves HTTP rejection codes after aborting the request', () => {
    for (const code of [403, 429, 505]) {
        class XHR {
            open() {}
            setRequestHeader() {}
            send() { this.status = code; this.onload(); }
            abort() { this.status = 0; }
        }
        const env = { Uint8Array, XMLHttpRequest: XHR, setTimeout, clearTimeout, btoa: s => Buffer.from(s, 'binary').toString('base64') };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/js/doh-engine.js'), 'utf8'), env);
        let result;
        env.NetDoH.probe('https://resolver.example/dns-query', 100, value => { result = value; });
        assert.equal(result.reason, 'dnsHttp');
        assert.equal(result.httpStatus, code);
    }
});
