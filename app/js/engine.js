(function (root) {
    'use strict';
    var sequence = 0;
    var KiB = 1024;
    var MiB = KiB * KiB;

    function now() {
        return root.performance && root.performance.now ? root.performance.now() : Date.now();
    }

    function fresh(url) {
        sequence += 1;
        return url + (url.indexOf('?') < 0 ? '?' : '&') + '_ns=' + Date.now() + '-' + sequence;
    }

    function median(values) {
        var sorted = values.slice().sort(function (a, b) { return a - b; });
        var middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    // Image requests work without CORS; only a decoded image counts as a reply.
    function probe(url, options, progress, done) {
        var samples = [];
        var image = null;
        var timer = null;
        var gap = null;
        var finished = false;
        var attempts = 0;

        function release() {
            root.clearTimeout(timer);
            if (image) {
                image.onload = null;
                image.onerror = null;
                image.src = '';
                image = null;
            }
        }

        function finish(reason) {
            if (finished) { return; }
            finished = true;
            root.clearTimeout(gap);
            release();
            var spread = null;
            var total = 0;
            var i;
            if (samples.length > 1) {
                for (i = 1; i < samples.length; i += 1) {
                    total += Math.abs(samples[i] - samples[i - 1]);
                }
                spread = total / (samples.length - 1);
            }
            done({ reason: reason, samples: samples, attempts: attempts, requested: options.samples,
                ms: samples.length ? median(samples) : null, spread: spread });
        }

        function next() {
            if (finished) { return; }
            attempts += 1;
            image = new root.Image();
            var start = now();
            image.onload = function () {
                samples.push(Math.max(1, now() - start));
                release();
                progress({ samples: samples.length, count: options.samples });
                if (samples.length === options.samples) { finish('ok'); }
                else { gap = root.setTimeout(next, 180); }
            };
            image.onerror = function () { finish('resource'); };
            timer = root.setTimeout(function () { finish('timeout'); }, options.timeoutMs);
            image.src = fresh(url);
        }

        next();
        return { cancel: function () { finish('cancelled'); } };
    }

    // At most two finite 1 MiB bodies are in flight. No body is saved or retained.
    function download(server, options, progress, done) {
        var active = [];
        var finished = false;
        var reserved = 0;
        var received = 0;
        var complete = 0;
        var chunkSize = server.librespeed ? MiB : 256 * KiB;
        var start = now();
        var lastTick = start;
        var lastBytes = 0;
        var ticker;
        var deadline;
        var pumping = false;

        function bytes() {
            var value = received;
            var i;
            for (i = 0; i < active.length; i += 1) { value += active[i].loaded; }
            return value;
        }

        function snapshot(reason) {
            var elapsed = Math.max(1, now() - start);
            var value = bytes();
            return { reason: reason, bytes: value, elapsedMs: elapsed,
                mbps: value * 8 / elapsed / 1000, complete: complete,
                fraction: Math.min(1, elapsed / options.durationMs),
                budgetFraction: value / options.budgetBytes };
        }

        function finish(reason) {
            if (finished) { return; }
            finished = true;
            root.clearInterval(ticker);
            root.clearTimeout(deadline);
            var result = snapshot(reason);
            var old = active.slice();
            active = [];
            old.forEach(function (request) { request.stop(); });
            done(result);
        }

        function request(size) {
            var xhr = new root.XMLHttpRequest();
            var record = { loaded: 0, stop: stop };
            var settled = false;
            var stall = null;
            var began = now();
            var validHeaders = false;
            active.push(record);
            reserved += size;

            function stop() {
                settled = true;
                root.clearTimeout(stall);
                if (xhr) {
                    xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onabort = xhr.onprogress = xhr.onreadystatechange = null;
                    xhr.abort();
                    xhr = null;
                }
            }

            function fail(reason) {
                if (!settled && !finished) { finish(reason); }
            }

            function watchdog() {
                root.clearTimeout(stall);
                stall = root.setTimeout(function () { fail('timeout'); }, options.timeoutMs);
            }

            try {
                xhr.open('GET', fresh(server.url + (server.librespeed ? '?ckSize=' + size / MiB : '?bytes=' + size)), true);
                xhr.responseType = 'arraybuffer';
                xhr.onreadystatechange = function () {
                    if (settled || finished || xhr.readyState !== 2) { return; }
                    var type = xhr.getResponseHeader('Content-Type') || '';
                    var length = xhr.getResponseHeader('Content-Length');
                    if (xhr.status !== 200) { fail('http'); return; }
                    if (type.toLowerCase().indexOf('application/octet-stream') !== 0 || (length !== null && Number(length) !== size)) {
                        fail('payload'); return;
                    }
                    validHeaders = true;
                    watchdog();
                };
                xhr.onprogress = function (event) {
                    if (settled || finished || !validHeaders) { return; }
                    if (event.loaded > size) { fail('payload'); return; }
                    if (event.loaded > record.loaded) { record.loaded = event.loaded; watchdog(); }
                };
                xhr.onload = function () {
                    if (settled || finished) { return; }
                    if (!validHeaders || !xhr.response || xhr.response.byteLength !== size) { fail('payload'); return; }
                    received += size;
                    complete += 1;
                    active.splice(active.indexOf(record), 1);
                    var elapsed = now() - began;
                    stop();
                    if (elapsed < 350) { chunkSize = MiB; }
                    else if (elapsed > 1500 && !server.librespeed) { chunkSize = 256 * KiB; }
                    pump();
                };
                xhr.onerror = function () { fail('network'); };
                xhr.ontimeout = function () { fail('timeout'); };
                xhr.onabort = function () { fail('network'); };
                watchdog();
                xhr.send();
            } catch (error) { fail('network'); }
        }

        function pump() {
            if (finished || pumping) { return; }
            pumping = true;
            while (!finished && active.length < 2 && reserved < options.budgetBytes) {
                request(Math.min(chunkSize, options.budgetBytes - reserved));
            }
            pumping = false;
            if (!finished && active.length === 0) { finish('budget'); }
        }

        deadline = root.setTimeout(function () { finish('duration'); }, options.durationMs);
        ticker = root.setInterval(function () {
            if (finished) { return; }
            var state = snapshot('running');
            var tick = now();
            state.intervalMbps = (state.bytes - lastBytes) * 8 / Math.max(1, tick - lastTick) / 1000;
            lastTick = tick; lastBytes = state.bytes;
            progress(state);
        }, 250);
        pump();
        return { cancel: function () { finish('cancelled'); } };
    }

    root.NetEngine = { probe: probe, download: download };
}(this));
