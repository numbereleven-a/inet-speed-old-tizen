(function (root) {
    'use strict';
    function now() { return root.performance && root.performance.now ? root.performance.now() : Date.now(); }
    function query() {
        var a = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), 1, 0, 0, 1, 0, 0, 0, 0, 0, 0];
        'example.com'.split('.').forEach(function (label) {
            a.push(label.length);
            for (var i = 0; i < label.length; i += 1) { a.push(label.charCodeAt(i)); }
        });
        return new Uint8Array(a.concat([0, 0, 1, 0, 1]));
    }
    function validate(buffer, sent) {
        if (!buffer || buffer.byteLength < 12 || buffer.byteLength > 65535) { return 'dnsInvalid'; }
        var b = new Uint8Array(buffer);
        function word(i) { if (i + 2 > b.length) { throw new Error(); } return b[i] * 256 + b[i + 1]; }
        function name(pos) {
            var labels = [], end = 0, jumps = 0;
            while (true) {
                if (pos >= b.length || ++jumps > 128) { throw new Error(); }
                var n = b[pos++];
                if (!n) { return { value: labels.join('.').toLowerCase(), end: end || pos }; }
                if ((n & 192) === 192) {
                    if (pos >= b.length) { throw new Error(); }
                    if (!end) { end = pos + 1; }
                    pos = (n & 63) * 256 + b[pos];
                } else {
                    if (n > 63 || pos + n > b.length) { throw new Error(); }
                    var label = '';
                    for (var j = 0; j < n; j += 1) { label += String.fromCharCode(b[pos++]); }
                    labels.push(label);
                }
            }
        }
        try {
            if (b[0] !== sent[0] || b[1] !== sent[1] || (b[2] & 248) !== 128 || (b[2] & 2) || word(4) !== 1) { return 'dnsInvalid'; }
            if ((b[3] & 15) !== 0) { return 'dnsResponseError'; }
            var q = name(12), pos = q.end;
            if (q.value !== 'example.com' || word(pos) !== 1 || word(pos + 2) !== 1) { return 'dnsInvalid'; }
            pos += 4;
            var answers = word(6), found = false;
            for (var i = 0; i < answers; i += 1) {
                pos = name(pos).end;
                var type = word(pos), cls = word(pos + 2), len = word(pos + 8);
                pos += 10;
                if (pos + len > b.length) { return 'dnsInvalid'; }
                if (type === 1 && cls === 1 && len === 4 && b[pos] !== 0 && b[pos] < 224 && b[pos] !== 127) { found = true; }
                pos += len;
            }
            return found ? null : 'dnsNoAnswer';
        } catch (error) { return 'dnsInvalid'; }
    }
    function probe(url, timeout, done) {
        var xhr = new root.XMLHttpRequest(), timer, finished = false;
        var sent = query(), encoded = '', start = now();
        for (var i = 0; i < sent.length; i += 1) { encoded += String.fromCharCode(sent[i]); }
        encoded = root.btoa(encoded).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        function finish(reason, status) {
            if (finished) { return; }
            finished = true;
            root.clearTimeout(timer);
            var ms = Math.max(1, now() - start);
            xhr.onload = xhr.onerror = xhr.onprogress = xhr.onreadystatechange = null;
            xhr.abort(); xhr = null;
            done({ reason: reason, ms: ms, httpStatus: status || 0 });
        }
        try {
            xhr.open('GET', url + (url.indexOf('?') < 0 ? '?' : '&') + 'dns=' + encoded, true);
            xhr.responseType = 'arraybuffer';
            xhr.setRequestHeader('Accept', 'application/dns-message');
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 2) {
                    var length = xhr.getResponseHeader('Content-Length');
                    if (length !== null && Number(length) > 65535) { finish('dnsInvalid'); }
                }
            };
            xhr.onprogress = function (e) { if (e.loaded > 65535) { finish('dnsInvalid'); } };
            xhr.onload = function () {
                if (xhr.status !== 200) { finish('dnsHttp', xhr.status); return; }
                if ((xhr.getResponseHeader('Content-Type') || '').split(';')[0].toLowerCase().replace(/^\s+|\s+$/g, '') !== 'application/dns-message') { finish('dnsInvalid'); return; }
                finish(validate(xhr.response, sent) || 'ok');
            };
            xhr.onerror = function () { finish('dnsNetwork'); };
            timer = root.setTimeout(function () { finish('dnsTimeout'); }, timeout);
            xhr.send();
        } catch (error) { finish('dnsNetwork'); }
        return { cancel: function () { finish('dnsStopped'); } };
    }
    root.NetDoH = { probe: probe, validate: validate, query: query };
}(this));
