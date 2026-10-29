(function (root) {
    'use strict';
    var providers = [
        ['Google', 'https://dns.google/dns-query'],
        ['Cloudflare', 'https://cloudflare-dns.com/dns-query'],
        ['Quad9', 'https://dns.quad9.net/dns-query'],
        ['Yandex', 'https://common.dot.dns.yandex.net/dns-query'],
        ['AdGuard', 'https://dns.adguard-dns.com/dns-query'],
        ['Control D', 'https://freedns.controld.com/p0'],
        ['OpenDNS', 'https://doh.opendns.com/dns-query'],
        ['CleanBrowsing', 'https://doh.cleanbrowsing.org/doh/security-filter/'],
        ['DNS.SB', 'https://doh.dns.sb/dns-query'],
        ['AliDNS', 'https://dns.alidns.com/dns-query']
    ].map(function (p) { return { name: p[0], url: p[1] }; });
    var detailTarget = null;
    var view = 'quick', pageIndex = 0, top = [];
    function visibleProviders() { return view === 'quick' ? providers : view === 'top' ? top : root.NetDNSExtended; }
    var t, getTimeout, beforeStart, current = null, timer = null, refreshTimer = null, active = null;
    var results = {}, cooldowns = {}, custom = null, count = 3;
    function el(id) { return document.getElementById('dns-' + id); }
    function clock() { return root.performance && root.performance.now ? root.performance.now() : Date.now(); }
    function left(url) { return Math.max(0, Math.ceil(((cooldowns[url] || 0) - clock()) / 1000)); }
    function stats(a) {
        var sorted = a.slice().sort(function (x, y) { return x - y; });
        return { median: sorted[Math.floor(sorted.length / 2)], min: sorted[0], max: sorted[sorted.length - 1] };
    }
    function description(p) {
        var r = results[p.url], wait = left(p.url), text = t('notTested');
        if (r) {
            text = r.samples.length + '/' + (r.required || count) + ' · ' + (r.reason === 'ok' ? t('done') : r.reason === 'dnsHttp' ? 'HTTP ' + r.httpStatus + ' · ' + t(r.httpStatus === 505 ? 'dnsHttpVersion' : 'dnsHttp') : t(r.reason));
            if (r.samples.length) {
                var s = stats(r.samples);
                text += ' · ' + Math.round(s.median) + ' ' + t('unitMs') + ' · min/max ' + Math.round(s.min) + '/' + Math.round(s.max) + ' · Δ ' + Math.round(s.max - s.min);
            }
        }
        return text + (wait ? ' · ' + t('retryAfter', { seconds: wait }) : '');
    }
    function explanation(p) {
        var r = p && results[p.url];
        if (!r || r.reason === 'ok' || r.reason === 'dnsRunning' || r.reason === 'dnsStopped') { return t('dnsNote'); }
        var message = r.reason === 'dnsNetwork' ? 'dnsNetworkDetail' : r.reason === 'dnsTimeout' ? 'dnsTimeoutDetail' : r.reason === 'dnsHttp' ? (r.httpStatus === 505 ? 'dnsVersionDetail' : 'dnsHttpDetail') : 'dnsAnswerDetail';
        return p.name + ': ' + (r.httpStatus ? 'HTTP ' + r.httpStatus + '. ' : '') + t(message);
    }
    function render() {
        if (!t) { return; }
        var entries = visibleProviders(), offset = pageIndex * 10;
        providers.forEach(function (unused, i) {
            var button = el('provider-' + i), p = entries[offset + i];
            button.classList[p ? 'remove' : 'add']('hidden');
            if (!p) { return; }
            button.querySelector('strong').textContent = (view === 'top' ? (offset + i + 1) + '. ' : '') + p.name;
            button.querySelector('small').textContent = p.url.replace('https://', '');
            button.querySelector('.dns-result').textContent = description(p);
            button.disabled = !!current;
        });
        el('extended').disabled = !!current;
        el('top').disabled = !!current;
        el('quick').disabled = !!current;
        el('prev').disabled = pageIndex === 0;
        el('next').disabled = (pageIndex + 1) * 10 >= entries.length;
        el('page').textContent = t(view === 'top' ? 'dnsTop' : view === 'extended' ? 'dnsExtendedList' : 'dnsQuick') + ' · ' + (entries.length ? pageIndex + 1 : 0) + '/' + Math.ceil(entries.length / 10) + ' · ' + entries.length;
        el('all').disabled = el('custom-test').disabled = el('address').disabled = el('edit').disabled = !!current;
        el('custom-result').textContent = custom ? description(custom) : '';
        el('note').textContent = explanation(detailTarget);
        var valid = (view === 'quick' ? providers.concat(custom ? [custom] : []) : top).filter(function (p) { var r = results[p.url]; return r && r.reason === 'ok' && r.samples.length === count && r.required !== 1; });
        valid.sort(function (a, b) { return stats(results[a.url].samples).median - stats(results[b.url].samples).median; });
        el('best').textContent = valid.length ? t('dnsBest') + ': ' + valid[0].name + ' · ' + Math.round(stats(results[valid[0].url].samples).median) + ' ' + t('unitMs') : t(view === 'top' ? 'dnsEmptyTop' : 'dnsNoWinner');
    }
    function stop() {
        var p = active;
        var old = current;
        current = null; active = null;
        clearTimeout(timer); timer = null;
        clearInterval(refreshTimer); refreshTimer = null;
        if (old && old.control) { old.control.cancel(); }
        if (p && results[p.url] && results[p.url].reason === 'dnsRunning') { results[p.url].reason = 'dnsStopped'; }
        el('status').textContent = t('dnsStopped');
        render();
    }
    function run(list, extended) {
        if (current) { return; }
        beforeStart();
        if (extended) { view = 'extended'; pageIndex = 0; top = []; }
        if (!refreshTimer && Object.keys(cooldowns).length) { refreshTimer = setInterval(tick, 1000); }
        var job = { index: 0, control: null, phase: extended ? 'screen' : 'normal', candidates: [] };
        current = job;
        el('status').textContent = t('dnsRunning');
        function next() {
            if (current !== job) { return; }
            if (job.index === list.length) {
                if (job.phase === 'screen') {
                    job.candidates.sort(function (a, b) { return stats(results[a.url].samples).median - stats(results[b.url].samples).median; });
                    list = job.candidates.slice(0, 20); job.phase = 'confirm'; job.index = 0;
                    timer = setTimeout(next, 0); return;
                }
                if (extended) {
                    top = list.filter(function (p) { var r = results[p.url]; return r && r.reason === 'ok' && r.required === 3 && r.samples.length === 3; });
                    top.sort(function (a, b) { return stats(results[a.url].samples).median - stats(results[b.url].samples).median; });
                    top = top.slice(0, 10); view = 'top'; pageIndex = 0; detailTarget = null;
                }
                current = null; active = null; el('status').textContent = t(extended ? 'dnsExtendedDone' : 'done'); render(); el('stop').focus(); return;
            }
            var p = list[job.index++];
            active = p;
            if (left(p.url)) { timer = setTimeout(next, 0); return; }
            results[p.url] = { samples: [], reason: 'dnsRunning', required: job.phase === 'screen' ? 1 : 3 };
            el('status').textContent = (extended ? t(job.phase === 'screen' ? 'dnsScreen' : 'dnsConfirm') + ' · ' : '') + job.index + '/' + list.length + ' · ' + p.name;
            render();
            function sample() {
                if (current !== job) { return; }
                job.control = root.NetDoH.probe(p.url, getTimeout(), function (reply) {
                    if (current !== job) { return; }
                    var r = results[p.url];
                    if (reply.reason === 'ok') { r.samples.push(reply.ms); }
                    else {
                        r.reason = reply.reason; r.httpStatus = reply.httpStatus; cooldowns[p.url] = clock() + 30000;
                        if (!refreshTimer) { refreshTimer = setInterval(tick, 1000); }
                        render(); timer = setTimeout(next, 120); return;
                    }
                    if (r.samples.length === r.required) {
                        r.reason = 'ok';
                        if (job.phase === 'screen') { job.candidates.push(p); }
                        render(); timer = setTimeout(next, 120);
                    }
                    else { render(); timer = setTimeout(sample, 120); }
                });
            }
            sample();
        }
        render(); el('stop').focus(); timer = setTimeout(next, 0);
    }
    function tick() {
        Object.keys(cooldowns).forEach(function (url) { if (!left(url)) { delete cooldowns[url]; } });
        render();
        if (!Object.keys(cooldowns).length) { clearInterval(refreshTimer); refreshTimer = null; }
    }
    function customTest() {
        var raw = el('address').value.replace(/^\s+|\s+$/g, ''), a = document.createElement('a');
        a.href = raw;
        if (!/^https:\/\/[^\/?#@]+(?:[\/?]|$)/i.test(raw) || /\s|\\|[{}]/.test(raw) || !a.hostname || a.username || a.password || /@/.test(raw.split('/')[2]) || a.hash || /(?:^|[?&])dns=/.test(a.search)) {
            el('custom-result').textContent = t('dnsAddressError'); return;
        }
        custom = { name: a.hostname, url: a.href };
        detailTarget = custom;
        run([custom]);
    }
    root.NetDNS = {
        init: function (translate, timeout, prepare) {
            t = translate; getTimeout = timeout; beforeStart = prepare;
            providers.forEach(function (p, i) {
                var button = document.createElement('button');
                button.id = 'dns-provider-' + i; button.className = 'dns-provider';
                var title = document.createElement('strong'), host = document.createElement('small'), result = document.createElement('span');
                title.textContent = p.name; host.textContent = p.url.replace('https://', ''); result.className = 'dns-result';
                button.appendChild(title); button.appendChild(host); button.appendChild(result);
                button.onfocus = function () { detailTarget = visibleProviders()[pageIndex * 10 + i]; render(); };
                button.onclick = function () { var selected = visibleProviders()[pageIndex * 10 + i]; detailTarget = selected; run([selected]); }; el('list').appendChild(button);
            });
            el('all').onfocus = function () { detailTarget = null; render(); };
            el('all').onclick = function () { view = 'quick'; pageIndex = 0; run(providers.slice()); };
            el('extended').onclick = function () { run(root.NetDNSExtended.slice(), true); };
            el('quick').onclick = function () { view = 'quick'; pageIndex = 0; detailTarget = null; render(); };
            el('top').onclick = function () { view = 'top'; pageIndex = 0; detailTarget = null; render(); };
            el('prev').onclick = function () { if (pageIndex > 0) { pageIndex--; detailTarget = null; render(); } };
            el('next').onclick = function () { if ((pageIndex + 1) * 10 < visibleProviders().length) { pageIndex++; detailTarget = null; render(); } };
            el('stop').onclick = stop; el('edit').onclick = function () { el('address').focus(); };
            el('custom-test').onfocus = function () { detailTarget = custom; render(); };
            el('custom-test').onclick = customTest;
            render();
        },
        render: render, stop: stop, running: function () { return !!current; }
    };
}(this));
