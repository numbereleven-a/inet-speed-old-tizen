const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { Uint8Array };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/js/doh-engine.js'), 'utf8'), context);
const engine = context.NetDoH;
function response(q, records = [Buffer.from([192,12,0,1,0,1,0,0,0,60,0,4,93,184,215,14])]) {
    const b = Buffer.concat([Buffer.from(q), ...records]);
    b[2] = 129; b[3] = 128; b.writeUInt16BE(records.length, 6);
    return b;
}
function buffer(b) { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
function wireName(domain) {
    return Buffer.concat([...domain.split('.').map(label => Buffer.concat([Buffer.from([label.length]), Buffer.from(label)])), Buffer.from([0])]);
}
function record(owner, type, data) {
    const header = Buffer.alloc(10);
    header.writeUInt16BE(type, 0); header.writeUInt16BE(1, 2); header.writeUInt16BE(data.length, 8);
    return Buffer.concat([owner, header, data]);
}
test('DoH validates the matching question and usable A answer', () => {
    const q = engine.query();
    assert.equal(engine.validate(buffer(response(q)), q), null);
    for (const edit of [b => b[0] ^= 1, b => b[3] = 131, b => b[7] = 0, b => b[b.length-4] = 0, b => b[2] |= 2, b => b[12] = 255]) {
        const b = response(q); edit(b);
        assert.notEqual(engine.validate(buffer(b), q), null);
    }
    assert.equal(engine.validate(new ArrayBuffer(5), q), 'dnsInvalid');
});

test('DoH accepts only A records belonging to the question or its CNAME chain', () => {
    const q = engine.query();
    const question = Buffer.from([192, 12]);
    const alias = wireName('alias.example');
    const edge = wireName('edge.example');
    const address = record(edge, 1, Buffer.from([192, 0, 2, 1]));
    const validate = records => engine.validate(buffer(response(q, records)), q);
    assert.equal(validate([address]), 'dnsNoAnswer', 'An unrelated A record cannot satisfy the question');
    // Reverse record order and a compressed CNAME target must still resolve correctly.
    const chain = [address, record(alias, 5, Buffer.from([192, q.length])), record(question, 5, wireName('ALIAS.EXAMPLE'))];
    assert.equal(validate(chain), null);
    assert.equal(validate([address, record(question, 5, alias)]), 'dnsNoAnswer', 'The entire chain must reach the A record');
    assert.equal(validate([record(question, 5, alias), record(alias, 5, question)]), 'dnsInvalid', 'CNAME cycles must terminate');
    const malformed = record(question, 5, Buffer.concat([alias, Buffer.from([0])]));
    assert.equal(validate([address, malformed]), 'dnsInvalid', 'CNAME data must fit its declared record length');
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
