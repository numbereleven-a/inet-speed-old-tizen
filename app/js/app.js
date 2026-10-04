(function () {
    'use strict';
    var sites = window.NetTargets.sites;
    var servers = window.NetTargets.servers;
    var siteResults = {};
    var speedResults = {};
    var cooldowns = {};
    var cooldownTimer = null;
    var summarySites = [];
    var manualTarget = null;
    var settings = { language: 'en', timeout: 3, samples: 3, duration: 10, budget: 32, selected: [] };
    var choices = { timeout: [2, 3, 5], samples: [3, 5], duration: [6, 10, 15], budget: [8, 32, 64] };
    var page = 'overview';
    var group = 'all';
    var run = null;
    var controller = null;
    var plot = [];
    var modalFocus = null;
    var modalOpen = false;
    var modalSite = null;
    var lastServer = null;
    var plotDuration = settings.duration;
    var footerKey = 'footerReady';
    var footerParams = null;
    var titles = {
        overview: ['overviewEyebrow', 'overviewTitle'],
        sites: ['sitesEyebrow', 'sitesTitle'],
        manual: ['sitesEyebrow', 'manualTitle'],
        speed: ['speedEyebrow', 'speedTitle'],
        information: ['infoEyebrow', 'infoTitle'],
        settings: ['settingsEyebrow', 'settingsTitle'],
        help: ['helpEyebrow', 'helpTitle']
    };

    function el(id) { return document.getElementById(id); }
    function setText(id, value) { el(id).textContent = value; }
    function hidden(id, value) { el(id).classList[value ? 'add' : 'remove']('hidden'); }
    function t(key, params) {
        var text = window.NetStrings[settings.language][key];
        return params ? text.replace(/\{(\w+)\}/g, function (match, name) { return params[name]; }) : text;
    }
    function siteName(site) { return site.id === 'yandex' ? t('siteYandex') : site.id === 'ria' ? t('siteRia') : site.name; }
    function footer(key, params) { footerKey = key; footerParams = params; setText('footer-status', t(key, params)); }
    function number(value) { return value < 10 ? value.toFixed(1) : Math.round(value).toString(); }
    function isSpeed(result) { return result && (result.reason === 'duration' || result.reason === 'budget') && result.bytes > 0 && result.elapsedMs >= 500; }
    function clock() { return window.performance && window.performance.now ? window.performance.now() : Date.now(); }
    function waitLeft(id) { return Math.max(0, Math.ceil(((cooldowns[id] || 0) - clock()) / 1000)); }
    function updateNetwork() {
        var offline = navigator.onLine === false;
        setText('network-state', t(offline ? 'networkOffline' : 'networkReady'));
        el('network-state').parentNode.classList[offline ? 'add' : 'remove']('offline');
    }
    function updateSiteDetail(site) {
        var stored = siteResults[site.id];
        var detail = siteName(site) + ' · ' + site.host;
        if (stored && stored.samples && stored.samples.length) {
            detail += ' · ' + t('detailProbes', { values: stored.samples.map(function (sample) { return Math.round(sample); }).join(', '), unit: t('unitMs') });
            if (stored.spread !== null) { detail += ' · ' + t('detailVariation', { value: Math.round(stored.spread), unit: t('unitMs') }); }
        }
        if (waitLeft(site.id)) { detail += ' · ' + t('retryAfter', { seconds: waitLeft(site.id) }); }
        setText('site-detail', detail);
    }
    function updateSiteDialog() {
        if (!modalSite) { return; }
        var button = el('modal-actions').firstChild;
        var remaining = waitLeft(modalSite.id);
        button.textContent = run ? t('alreadyRunning') : remaining ? t('retryAfter', { seconds: remaining }) : t('testSite');
        button.disabled = !!run || remaining > 0;
        if (button.disabled && document.activeElement === button) { el('modal-actions').querySelector('button:not([disabled])').focus(); }
    }
    function tickCooldowns() {
        Object.keys(cooldowns).forEach(function (id) { if (!waitLeft(id)) { delete cooldowns[id]; } });
        sites.forEach(function (site) {
            renderSite(site);
            if (document.activeElement === el('site-' + site.id)) { updateSiteDetail(site); }
        });
        servers.forEach(renderSpeed);
        if (manualTarget) { renderSite(manualTarget); }
        updateSiteDialog();
        if (!Object.keys(cooldowns).length) { clearInterval(cooldownTimer); cooldownTimer = null; }
    }
    function startCooldown(id) {
        cooldowns[id] = clock() + 30000;
        if (cooldownTimer === null) { cooldownTimer = setInterval(tickCooldowns, 1000); }
    }
    function focusPage() {
        var first = el('page-' + page).querySelector('button:not([disabled])') || document.querySelector('.nav.active');
        if (modalOpen) { modalFocus = first; updateSiteDialog(); }
        else { first.focus(); }
    }
    function selection() {
        return sites.filter(function (site) {
            return group === 'all' || site.group === group || (group === 'selected' && settings.selected.indexOf(site.id) >= 0);
        });
    }

    function readSettings() {
        try {
            var stored = JSON.parse(localStorage.getItem('netscope-settings'));
            if (!stored) { return; }
            if (stored.language === 'en' || stored.language === 'ru') { settings.language = stored.language; }
            Object.keys(choices).forEach(function (key) {
                if (choices[key].indexOf(stored[key]) >= 0) { settings[key] = stored[key]; }
            });
            if (Array.isArray(stored.selected)) {
                settings.selected = sites.filter(function (site) { return stored.selected.indexOf(site.id) >= 0; }).map(function (site) { return site.id; });
            }
        } catch (error) { /* A new or storage-restricted installation uses defaults. */ }
    }

    function saveSettings() {
        try { localStorage.setItem('netscope-settings', JSON.stringify(settings)); }
        catch (error) { footer('settingsTemporary'); }
    }

    function updateSettings() {
        setText('value-language', (settings.language === 'en' ? 'English' : 'Русский') + '  ›');
        setText('value-timeout', settings.timeout + ' ' + t('unitSeconds') + '  ›');
        setText('value-samples', t('samplesValue', { count: settings.samples }) + '  ›');
        setText('value-duration', settings.duration + ' ' + t('unitSeconds') + '  ›');
        setText('value-budget', settings.budget + ' ' + t('unitMiB') + '  ›');
        setText('overview-limits', t('overviewLimits', { limit: settings.budget * servers.length }));
    }

    function applyLanguage() {
        document.documentElement.lang = settings.language;
        Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (node) { node.textContent = t(node.getAttribute('data-i18n')); });
        showPage(page, false);
        updateSettings(); applyFilter();
        if (el('manual-error').textContent) { setText('manual-error', t('manualInvalid')); }
        sites.forEach(function (site) {
            setText('compact-name-' + site.id, siteName(site));
            setText('site-name-' + site.id, siteName(site));
            renderSite(site);
        });
        servers.forEach(renderSpeed);
        if (manualTarget) { renderSite(manualTarget); }
        updateNetwork();
        setText('footer-status', t(footerKey, footerParams));
        if (lastServer && speedResults[lastServer.id]) { renderCaptions(lastServer, speedResults[lastServer.id]); }
        else { setText('gauge-caption', t('waiting')); setText('chart-caption', t('waiting')); }
        summary();
        window.NetInformation.render();
    }

    function showPage(name, focusContent) {
        if (modalOpen) { closeModal(); }
        var previous = page;
        if (previous === 'information' && name !== previous) { window.NetInformation.cancel(); }
        page = name;
        Object.keys(titles).forEach(function (key) { hidden('page-' + key, key !== name); });
        var nav = document.querySelectorAll('.nav');
        Array.prototype.forEach.call(nav, function (button) { button.classList[button.getAttribute('data-page') === (name === 'manual' ? 'sites' : name) ? 'add' : 'remove']('active'); });
        setText('page-eyebrow', t(titles[name][0]));
        setText('page-title', t(titles[name][1]));
        if (name === 'speed') { drawChart(); }
        if (name === 'information' && previous !== name) { window.NetInformation.refresh(); }
        if (focusContent) {
            var first = el('page-' + name).querySelector('button:not([disabled])');
            if (first) { first.focus(); }
        }
    }

    function logo(site) {
        var node = document.createElement('span');
        node.className = 'site-logo';
        node.style.color = site.color;
        node.textContent = site.letter;
        return node;
    }

    function makeSites() {
        sites.forEach(function (site) {
            var compact = document.createElement('button');
            compact.className = 'compact-site';
            compact.appendChild(logo(site));
            var copy = document.createElement('span');
            copy.className = 'compact-name';
            var compactName = document.createElement('span');
            compactName.id = 'compact-name-' + site.id;
            compactName.textContent = siteName(site);
            copy.appendChild(compactName);
            var value = document.createElement('span');
            value.id = 'compact-' + site.id;
            value.className = 'compact-value';
            value.textContent = t('notTested');
            copy.appendChild(value);
            compact.appendChild(copy);
            compact.onclick = function () { showPage('sites', false); el('site-' + site.id).focus(); siteDialog(site); };
            el('overview-sites').appendChild(compact);

            var card = document.createElement('button');
            card.className = 'site-card';
            card.id = 'site-' + site.id;
            card.appendChild(logo(site));
            var info = document.createElement('span');
            info.className = 'site-info';
            var title = document.createElement('span');
            title.className = 'site-name';
            var name = document.createElement('span');
            name.id = 'site-name-' + site.id;
            name.textContent = siteName(site);
            title.appendChild(name);
            var check = document.createElement('span');
            check.className = 'selection-mark';
            check.id = 'selection-' + site.id;
            title.appendChild(check);
            info.appendChild(title);
            var host = document.createElement('span');
            host.className = 'site-host';
            host.textContent = site.host;
            info.appendChild(host);
            card.appendChild(info);
            var result = document.createElement('span');
            result.className = 'site-result';
            result.innerHTML = '<span class="site-ms" id="ms-' + site.id + '">—</span><span class="site-state" id="state-' + site.id + '">' + t('notTested') + '</span>';
            card.appendChild(result);
            card.onclick = function () { siteDialog(site); };
            card.onfocus = function () { updateSiteDetail(site); };
            el('site-list').appendChild(card);
        });
        applyFilter();
    }

    function applyFilter() {
        // Keep all rows visible so a remote user can compare results and make a custom group.
        var chosen = selection();
        sites.forEach(function (site) {
            setText('selection-' + site.id, settings.selected.indexOf(site.id) >= 0 ? '✓' : '');
            el('site-' + site.id).classList[chosen.indexOf(site) < 0 ? 'add' : 'remove']('excluded');
        });
        var filters = el('site-filters').querySelectorAll('button');
        Array.prototype.forEach.call(filters, function (button) {
            var selected = button.getAttribute('data-group') === group || (button.id === 'custom-selection' && group === 'selected');
            button.classList[selected ? 'add' : 'remove']('selected');
        });
        setText('start-sites', t('testSites', { count: selection().length }));
    }

    function errorText(reason) {
        if (reason === 'timeout') { return t('errorTimeout'); }
        if (reason === 'payload') { return t('errorPayload'); }
        if (reason === 'http') { return t('errorHttp'); }
        if (reason === 'cancelled') { return t('stopped'); }
        if (reason === 'budget' || reason === 'duration') { return t('tooShort'); }
        return t('errorNetwork');
    }

    function renderSite(site) {
        var result = siteResults[site.id];
        var value = '—';
        var state = t('notTested');
        var compact = t('notTested');
        var color = '';
        if (result) {
            if (result.reason === 'running') { state = result.label; compact = t('testing'); }
            else if (result.ms !== null && typeof result.ms === 'number') {
                value = Math.round(result.ms) + ' ' + t('unitMs');
                compact = value;
                state = t('replies', { received: result.samples.length, count: result.requested });
                color = result.reason === 'ok' ? (result.ms < 300 ? 'good' : 'warning') : 'warning';
                if (result.reason !== 'ok') { state += ' · ' + t(result.reason === 'cancelled' ? 'stoppedShort' : 'failedShort'); }
            } else {
                value = result.reason === 'cancelled' ? '—' : t('noReply');
                compact = t(result.reason === 'cancelled' ? 'stopped' : 'noReply');
                state = errorText(result.reason);
                color = result.reason === 'cancelled' ? '' : 'bad';
            }
        }
        if (waitLeft(site.id)) { state += ' · ' + t('retryAfter', { seconds: waitLeft(site.id) }); }
        var id = site.manual ? 'manual' : site.id;
        setText('ms-' + id, value);
        el('ms-' + id).className = 'site-ms ' + color;
        setText('state-' + id, state);
        if (!site.manual) {
            setText('compact-' + id, compact);
            el('compact-' + id).className = 'compact-value ' + color;
        }
    }

    function startManual() {
        if (run) { return; }
        var address = el('manual-address').value.replace(/^\s+|\s+$/g, '');
        var parsed = document.createElement('a');
        if (!/^[a-z][a-z0-9+.-]*:/i.test(address) || /^[^\/:]+:\d+(?:\/|$)/.test(address)) { address = 'https://' + address; }
        parsed.href = address;
        if (!/^https?:\/\//i.test(address) || /\s|\\/.test(address) || !parsed.hostname || /@/.test(address.split('/')[2])) {
            setText('manual-error', t('manualInvalid'));
            el('manual-edit').focus();
            return;
        }
        var url = parsed.protocol + '//' + parsed.host + '/favicon.ico';
        if (!manualTarget || manualTarget.url !== url) {
            if (manualTarget) { delete siteResults[manualTarget.id]; }
            manualTarget = { id: 'manual:' + url, name: parsed.host, host: parsed.host, url: url, manual: true };
        }
        setText('manual-error', '');
        setText('manual-host', url);
        hidden('manual-result', false);
        start([manualTarget], []);
    }

    function makeServers() {
        servers.forEach(function (server) {
            var button = document.createElement('button');
            button.id = 'server-' + server.id;
            button.className = 'server-card';
            button.innerHTML = '<span class="server-name">' + server.name + '</span><span class="server-note" id="server-note-' + server.id + '">' + t(server.note) + '</span><span class="server-value" id="speed-' + server.id + '">— <small>' + t('unitMbps') + '</small></span><span class="server-state" id="speed-state-' + server.id + '">' + t('testServer') + '</span>';
            button.onclick = function () { start([], [server]); };
            el('server-list').appendChild(button);
        });
    }

    function renderSpeed(server) {
        var result = speedResults[server.id];
        var node = el('speed-' + server.id);
        var value = '—';
        var note = t('testServer');
        var color = '';
        if (result) {
            if (result.reason === 'running') { value = number(result.mbps); note = t('downloading') + ' · ' + number(result.bytes / 1048576) + ' ' + t('unitMiB'); }
            else if (isSpeed(result)) {
                value = number(result.mbps);
                color = 'good';
                note = t(result.reason === 'budget' ? 'trafficLimit' : 'done') + ' · ' + number(result.bytes / 1048576) + ' ' + t('unitMiB') + ' · ' + number(result.elapsedMs / 1000) + ' ' + t('unitSeconds');
            } else {
                note = errorText(result.reason);
                color = result.reason === 'cancelled' || result.reason === 'budget' || result.reason === 'duration' ? 'warning' : 'bad';
            }
        }
        if (waitLeft(server.id)) { note += ' · ' + t('retryAfter', { seconds: waitLeft(server.id) }); }
        node.innerHTML = value + ' <small>' + t('unitMbps') + '</small>';
        node.className = 'server-value ' + color;
        setText('speed-state-' + server.id, note);
        setText('server-note-' + server.id, t(server.note));
    }

    function renderCaptions(server, result) {
        var valid = isSpeed(result);
        setText('gauge-value', valid ? number(result.mbps) : '—');
        setText('gauge-caption', valid ? server.name : errorText(result.reason));
        setText('chart-caption', valid ? server.name + ' · ' + number(result.mbps) + ' ' + t('unitMbps') : server.name + ' · ' + errorText(result.reason));
        drawGauge(valid ? result.mbps : 0);
    }

    function summary() {
        var replies = summarySites.map(function (site) { return siteResults[site.id]; }).filter(function (result) { return result && typeof result.ms === 'number'; });
        var values = replies.map(function (result) { return result.ms; }).sort(function (a, b) { return a - b; });
        var speeds = servers.map(function (server) { return speedResults[server.id]; }).filter(isSpeed);
        var latency = values.length ? (values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2 : null;
        el('summary-latency').innerHTML = (latency !== null ? Math.round(latency) : '—') + ' <span>' + t('unitMs') + '</span>';
        el('summary-sites').innerHTML = summarySites.length ? replies.length + ' <span>/ ' + summarySites.length + '</span>' : '—';
        if (speeds.length) {
            var best = Math.max.apply(Math, speeds.map(function (result) { return result.mbps; }));
            el('summary-speed').innerHTML = number(best) + ' <span>' + t('unitMbps') + '</span>';
            setText('summary-server', t(speeds.length > 1 ? 'bestServers' : 'oneServer'));
            if (!run) {
                var bestServer = servers.filter(function (server) { return isSpeed(speedResults[server.id]) && speedResults[server.id].mbps === best; })[0];
                setText('gauge-value', number(best)); setText('gauge-caption', bestServer.name); drawGauge(best);
            }
        } else { el('summary-speed').innerHTML = '— <span>' + t('unitMbps') + '</span>'; setText('summary-server', t('summaryServer')); }
        setText('summary-status', t(run ? 'testRunning' : Object.keys(siteResults).length || Object.keys(speedResults).length ? 'sessionResults' : 'summaryNotRun'));
    }

    function drawGauge(value) {
        var context = el('gauge').getContext('2d');
        var left = Math.PI * 0.85;
        var right = Math.PI * 2.15;
        context.clearRect(0, 0, 510, 300);
        context.lineWidth = 17;
        context.lineCap = 'round';
        context.strokeStyle = '#2b3b59';
        context.beginPath(); context.arc(255, 179, 146, left, right); context.stroke();
        if (value > 0) {
            context.strokeStyle = '#8cb8ff';
            context.beginPath(); context.arc(255, 179, 146, left, left + (right - left) * Math.min(1, value / 100)); context.stroke();
        }
        context.font = '16px Arial'; context.fillStyle = '#8ca2c6';
        context.fillText('0', 73, 259); context.fillText('100+', 410, 259);
    }

    function drawChart() {
        var canvas = el('speed-chart');
        if (canvas.clientWidth) { canvas.width = canvas.clientWidth; }
        var width = canvas.width;
        var context = canvas.getContext('2d');
        var max = Math.max(10, Math.ceil(Math.max.apply(Math, plot.map(function (point) { return point.mbps; }).concat([1])) / 10) * 10);
        var i;
        context.clearRect(0, 0, width, 245);
        context.font = '16px Arial';
        for (i = 0; i < 4; i += 1) {
            var y = 20 + i * 65;
            context.strokeStyle = '#2c3c57'; context.lineWidth = 1;
            context.beginPath(); context.moveTo(60, y); context.lineTo(width - 10, y); context.stroke();
            context.fillStyle = '#839bbb'; context.fillText(Math.round(max * (3 - i) / 3).toString(), 5, y + 5);
        }
        if (!plot.length) { return; }
        context.beginPath();
        plot.forEach(function (point, index) {
            var x = 60 + Math.min(1, point.seconds / plotDuration) * (width - 70);
            var y = 215 - point.mbps / max * 195;
            if (!index) { context.moveTo(x, y); } else { context.lineTo(x, y); }
        });
        context.lineWidth = 4; context.strokeStyle = '#8bb7ff'; context.stroke();
    }

    function locked(value) {
        ['start-all', 'start-sites', 'start-speed', 'start-manual', 'manual-edit', 'manual-address', 'setting-language', 'setting-timeout', 'setting-samples', 'setting-duration', 'setting-budget'].forEach(function (id) { el(id).disabled = value; });
        servers.forEach(function (server) { el('server-' + server.id).disabled = value; });
    }

    function start(chosenSites, chosenServers) {
        if (run) { return; }
        var jobs = chosenSites.map(function (target) { return { kind: 'site', target: target }; }).concat(chosenServers.map(function (target) { return { kind: 'speed', target: target }; }));
        if (!jobs.length) { showModal(t('chooseSitesTitle'), t('chooseSitesText'), [{ label: t('gotIt'), action: closeModal }]); return; }
        closeModal();
        // Preserve failed results when their targets are still on cooldown.
        chosenSites.forEach(function (site) { if (!waitLeft(site.id)) { delete siteResults[site.id]; } renderSite(site); });
        chosenServers.forEach(function (server) { if (!waitLeft(server.id)) { delete speedResults[server.id]; } renderSpeed(server); });
        if (chosenSites.length) { summarySites = chosenSites.slice(); }
        var token = { jobs: jobs, index: 0, skipped: 0, job: null, nextTimer: null };
        run = token;
        locked(true);
        hidden('run-bar', false);
        el('stop-run').focus();
        footer('footerStopHint');
        summary();

        function next() {
            if (run !== token) { return; }
            if (token.index === jobs.length) {
                run = null; controller = null;
                locked(false); hidden('run-bar', true); summary();
                footer(token.skipped ? 'footerSkipped' : 'footerComplete', { count: token.skipped });
                focusPage();
                return;
            }
            var job = jobs[token.index];
            token.job = job;
            token.index += 1;
            var target = job.target;
            var results = job.kind === 'site' ? siteResults : speedResults;
            var render = job.kind === 'site' ? renderSite : renderSpeed;
            if (waitLeft(target.id)) {
                render(target);
                token.skipped += 1;
                token.nextTimer = setTimeout(next, 0);
                return;
            }
            setText('run-title', t(job.kind === 'site' ? 'runResponse' : 'runSpeed') + ' · ' + (job.kind === 'site' ? siteName(target) : target.name));
            setText('run-subtitle', t('runStep', { index: token.index, count: jobs.length }));
            el('run-progress-fill').style.width = ((token.index - 1) / jobs.length * 100) + '%';
            results[target.id] = { reason: 'running', label: t('probeStep', { count: settings.samples }), mbps: 0, bytes: 0 };
            render(target);

            function done(result) {
                if (run !== token) { return; }
                controller = null;
                results[target.id] = result;
                if (result.reason !== 'ok' && result.reason !== 'duration' && result.reason !== 'budget') { startCooldown(target.id); }
                render(target); summary();
                if (job.kind === 'speed') {
                    renderCaptions(target, result);
                }
                token.nextTimer = setTimeout(next, 180);
            }

            if (job.kind === 'site') {
                controller = window.NetEngine.probe(target.url, { timeoutMs: settings.timeout * 1000, samples: settings.samples }, function (state) {
                    if (run !== token) { return; }
                    results[target.id].label = t('probeReplies', { received: state.samples, count: state.count });
                    render(target);
                }, done);
            } else {
                lastServer = target;
                plotDuration = settings.duration;
                plot = []; drawChart(); drawGauge(0); setText('gauge-value', '—'); setText('gauge-caption', target.name); setText('chart-caption', target.name + ' · ' + t('downloading'));
                controller = window.NetEngine.download(target, { timeoutMs: settings.timeout * 1000, durationMs: settings.duration * 1000, budgetBytes: settings.budget * 1048576 }, function (state) {
                    if (run !== token) { return; }
                    results[target.id] = state; render(target);
                    plot.push({ seconds: state.elapsedMs / 1000, mbps: state.intervalMbps }); drawChart(); drawGauge(state.mbps); setText('gauge-value', number(state.mbps));
                    setText('run-subtitle', number(state.bytes / 1048576) + ' ' + t('unitMiB') + ' · ' + number(state.elapsedMs / 1000) + ' ' + t('unitSeconds') + ' / ' + settings.duration + ' ' + t('unitSeconds'));
                    el('run-progress-fill').style.width = ((token.index - 1 + Math.max(state.fraction, state.budgetFraction)) / jobs.length * 100) + '%';
                }, done);
            }
        }
        token.nextTimer = setTimeout(next, 0);
    }

    function stop() {
        if (!run) { return; }
        var token = run;
        run = null;
        clearTimeout(token.nextTimer);
        var result = null;
        // The engine's callback is ignored after detaching the run.
        if (controller) { controller.cancel(); controller = null; }
        if (token.job) {
            var target = token.job.target;
            if (token.job.kind === 'site') {
                result = siteResults[target.id];
                if (result && result.reason === 'running') { siteResults[target.id] = { reason: 'cancelled', ms: null }; renderSite(target); }
            } else {
                result = speedResults[target.id];
                if (result && result.reason === 'running') {
                    speedResults[target.id] = { reason: 'cancelled' }; renderSpeed(target); setText('gauge-value', '—'); setText('gauge-caption', t('stopped')); drawGauge(0);
                    setText('chart-caption', t('stopped'));
                }
            }
        }
        locked(false); hidden('run-bar', true); summary();
        footer('footerStopped');
        focusPage();
    }

    function showModal(title, text, actions) {
        if (!modalOpen) { modalFocus = document.activeElement; }
        modalOpen = true;
        modalSite = null;
        setText('modal-title', title); setText('modal-text', text);
        el('modal-actions').innerHTML = '';
        actions.forEach(function (item) {
            var button = document.createElement('button'); button.textContent = item.label;
            button.disabled = !!item.disabled; button.onclick = item.action;
            el('modal-actions').appendChild(button);
        });
        hidden('modal', false);
        el('modal-actions').querySelector('button:not([disabled])').focus();
    }

    function closeModal() {
        if (!modalOpen) { return; }
        modalOpen = false; modalSite = null; hidden('modal', true);
        if (modalFocus && !modalFocus.disabled) { modalFocus.focus(); }
    }

    function siteDialog(site) {
        var chosen = settings.selected.indexOf(site.id) >= 0;
        var remaining = waitLeft(site.id);
        showModal(siteName(site), t('siteDialogText', { host: site.host }), [
            { label: run ? t('alreadyRunning') : remaining ? t('retryAfter', { seconds: remaining }) : t('testSite'), disabled: !!run || remaining > 0, action: function () { start([site], []); } },
            { label: t(chosen ? 'removeSelected' : 'addSelected'), action: function () {
                if (chosen) { settings.selected.splice(settings.selected.indexOf(site.id), 1); } else { settings.selected.push(site.id); }
                saveSettings(); applyFilter(); closeModal();
            } },
            { label: t('close'), action: closeModal }
        ]);
        modalSite = site;
    }

    function exit() {
        stop();
        if (window.tizen && window.tizen.application) { window.tizen.application.getCurrentApplication().exit(); }
        else { closeModal(); footer('closeBrowser'); }
    }

    function back() {
        if (modalOpen) { closeModal(); }
        else if (run) { stop(); }
        else if (page === 'manual') { showPage('sites', true); }
        else if (page !== 'overview') { showPage('overview', true); }
        else { showModal(t('exitTitle'), t('exitText'), [{ label: t('stay'), action: closeModal }, { label: t('exit'), action: exit }]); }
    }

    function moveFocus(code) {
        var scope = modalOpen ? el('modal-actions') : el('screen');
        var candidates = scope.querySelectorAll('button:not([disabled]), input:not([disabled])');
        var origin = document.activeElement.getBoundingClientRect();
        var x = (origin.left + origin.right) / 2;
        var y = (origin.top + origin.bottom) / 2;
        var best = null;
        var score = Infinity;
        Array.prototype.forEach.call(candidates, function (button) {
            var rect = button.getBoundingClientRect();
            if (!rect.width || !rect.height || button === document.activeElement) { return; }
            var dx = (rect.left + rect.right) / 2 - x;
            var dy = (rect.top + rect.bottom) / 2 - y;
            var forward = code === 37 ? -dx : code === 39 ? dx : code === 38 ? -dy : dy;
            var side = code === 37 || code === 39 ? Math.abs(dy) : Math.abs(dx);
            if (forward < 4) { return; }
            var candidate = forward + side * 4;
            if (candidate < score) { score = candidate; best = button; }
        });
        if (best && code === 37 && best.classList.contains('nav') && !document.activeElement.classList.contains('nav')) {
            document.querySelector('.nav.active').focus();
        } else if (best) { best.focus(); }
    }

    function scale() {
        var factor = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
        el('screen').style.transform = 'scale(' + factor + ')';
        el('screen').style.webkitTransform = 'scale(' + factor + ')';
        el('screen').style.left = ((window.innerWidth - 1920 * factor) / 2) + 'px';
        el('screen').style.top = ((window.innerHeight - 1080 * factor) / 2) + 'px';
    }

    window.NetInformation.init(t);
    readSettings(); makeSites(); makeServers(); applyLanguage(); drawGauge(0); drawChart(); scale();
    Array.prototype.forEach.call(document.querySelectorAll('.nav'), function (button) { button.onclick = function () { showPage(button.getAttribute('data-page'), false); }; });
    el('start-all').onclick = function () { start(sites.slice(), servers.slice()); };
    el('start-sites').onclick = function () { start(selection(), []); };
    el('start-speed').onclick = function () { start([], servers.slice()); };
    el('open-sites').onclick = function () { showPage('sites', true); };
    el('open-manual').onclick = function () { showPage('manual', true); };
    el('manual-edit').onclick = function () { el('manual-address').focus(); };
    el('start-manual').onclick = startManual;
    el('manual-back').onclick = function () { showPage('sites', true); };
    el('manual-address').oninput = function () { setText('manual-error', ''); };
    el('stop-run').onclick = stop;
    Array.prototype.forEach.call(document.querySelectorAll('[data-group]'), function (button) { button.onclick = function () { group = button.getAttribute('data-group'); applyFilter(); }; });
    el('custom-selection').onclick = function () { group = 'selected'; applyFilter(); };
    el('setting-language').onclick = function () {
        settings.language = settings.language === 'en' ? 'ru' : 'en';
        applyLanguage(); saveSettings();
    };
    Object.keys(choices).forEach(function (key) {
        el('setting-' + key).onclick = function () {
            settings[key] = choices[key][(choices[key].indexOf(settings[key]) + 1) % choices[key].length];
            updateSettings(); saveSettings();
        };
    });
    window.addEventListener('resize', scale);
    window.addEventListener('offline', function () { updateNetwork(); stop(); });
    window.addEventListener('online', updateNetwork);
    window.addEventListener('beforeunload', function () { stop(); window.NetInformation.cancel(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { stop(); window.NetInformation.cancel(); } });
    document.addEventListener('keydown', function (event) {
        var code = event.keyCode;
        // Let the Samsung IME edit text, including arrows and Backspace.
        if (document.activeElement === el('manual-address') && !modalOpen) {
            if (code === 65376 || code === 13) { el('manual-address').blur(); el('start-manual').focus(); }
            else if (code === 65385 || code === 10009 || code === 27) { el('manual-address').blur(); el('manual-edit').focus(); }
            return;
        }
        if (code >= 37 && code <= 40) { event.preventDefault(); moveFocus(code); }
        else if (code === 13) {
            event.preventDefault();
            var active = document.activeElement;
            if (active.tagName === 'BUTTON' && !active.disabled && (!modalOpen || el('modal').contains(active))) { active.click(); }
        }
        else if (code === 10009 || code === 27 || code === 8) { event.preventDefault(); back(); }
        else if (code === 10182) { event.preventDefault(); exit(); }
    });
    el('start-all').focus();
}());
