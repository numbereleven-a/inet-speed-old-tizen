(function (root) {
    'use strict';
    var t;
    var data = {};
    var request = null;
    var storageIndex = 0;
    function el(id) { return document.getElementById('info-' + id); }
    function text(id, value) { el(id).textContent = value; }
    function validNumber(value) { return typeof value === 'number' && isFinite(value) && value >= 0; }
    function missing() { return t(request ? 'infoLoading' : 'infoUnavailable'); }
    function value(raw) { return typeof raw === 'string' && raw ? raw : missing(); }
    function bytes(raw) {
        if (!validNumber(raw)) { return missing(); }
        return raw >= 1073741824 ? (raw / 1073741824).toFixed(2) + ' ' + t('infoGiB') : Math.round(raw / 1048576) + ' ' + t('unitMiB');
    }
    function capacity(prefix, total, free) {
        var usable = validNumber(total) && total > 0 && validNumber(free) && free <= total;
        text(prefix + '-total', validNumber(total) && total > 0 ? bytes(total) : missing());
        text(prefix + '-free', usable ? bytes(free) : missing());
        text(prefix + '-used', usable ? bytes(total - free) : missing());
        el(prefix + '-fill').style.width = usable ? ((total - free) / total * 100) + '%' : '0%';
    }
    function render() {
        if (!t) { return; }
        text('status', t(request ? 'infoLoading' : 'infoSnapshot'));
        text('model', value(data.model));
        text('os', data.platform ? 'Tizen ' + data.platform : missing());
        text('firmware', value(data.firmware));
        text('display', data.display ? data.display : missing());
        text('language', value(data.locale));
        text('cpu', validNumber(data.cpu) && data.cpu <= 1 ? Math.round(data.cpu * 100) + '%' : missing());
        var type = data.networkType;
        text('connection', type === 'NONE' ? t('infoDisconnected') : value(type));
        var network = data.network || {};
        var notWifi = type === 'ETHERNET' || type === 'NONE';
        text('ssid', notWifi ? t('infoNotApplicable') : value(network.ssid));
        text('signal', notWifi ? t('infoNotApplicable') : validNumber(network.signalStrength) && network.signalStrength <= 1 ? Math.round(network.signalStrength * 100) + '%' : missing());
        text('security', notWifi ? t('infoNotApplicable') : value(network.securityMode));
        text('ip', value(network.ipAddress));
        text('mask', value(network.subnetMask));
        text('gateway', value(network.gateway));
        text('dns', value(network.dns));
        capacity('ram', data.totalMemory, data.freeMemory);
        var units = data.storage || [];
        var unit = units[storageIndex];
        el('storage-device').disabled = units.length < 2;
        text('storage-device', unit ? (unit.type === 'INTERNAL' ? t('infoInternal') : value(unit.type)) + ' · ' + (storageIndex + 1) + '/' + units.length + (units.length > 1 ? '  ›' : '') : missing());
        capacity('disk', unit && unit.capacity, unit && unit.availableCapacity);
    }
    function cancel() {
        if (request) { clearTimeout(request.timer); request.active = false; request = null; }
        render();
    }
    function read(object, method, argument) {
        try {
            if (!object || typeof object[method] !== 'function') { return undefined; }
            return argument === undefined ? object[method]() : object[method](argument);
        }
        catch (error) { return undefined; }
    }
    function refresh() {
        cancel();
        data = {};
        storageIndex = 0;
        var system = root.tizen && root.tizen.systeminfo;
        var product = root.webapis && root.webapis.productinfo;
        data.model = read(product, 'getModel');
        data.firmware = read(product, 'getFirmware');
        data.platform = read(system, 'getCapability', 'http://tizen.org/feature/platform.version');
        data.totalMemory = read(system, 'getTotalMemory');
        data.freeMemory = read(system, 'getAvailableMemory');
        if (!system || typeof system.getPropertyValue !== 'function') { render(); return; }
        var job = { active: true, pending: 0, started: false, timer: null };
        request = job;
        function finish() {
            clearTimeout(job.timer);
            job.active = false;
            request = null;
            render();
        }
        function property(name, receive) {
            job.pending++;
            function complete(result) {
                if (!job.active) { return; }
                if (result) { receive(result); }
                job.pending--;
                if (job.started && !job.pending) { finish(); }
                else { render(); }
            }
            try { system.getPropertyValue(name, complete, function () { complete(null); }); }
            catch (error) { complete(null); }
        }
        job.timer = setTimeout(finish, 3000);
        property('CPU', function (cpu) { data.cpu = cpu.load; });
        property('DISPLAY', function (display) {
            if (display.resolutionWidth > 0 && display.resolutionHeight > 0) { data.display = display.resolutionWidth + ' × ' + display.resolutionHeight; }
        });
        property('LOCALE', function (locale) { data.locale = locale.language; });
        property('STORAGE', function (storage) { data.storage = storage.units; });
        property('NETWORK', function (network) {
            data.networkType = network.networkType;
            if (network.networkType === 'WIFI' || network.networkType === 'ETHERNET') {
                property(network.networkType === 'WIFI' ? 'WIFI_NETWORK' : 'ETHERNET_NETWORK', function (details) { data.network = details; });
            }
        });
        job.started = true;
        if (!job.pending) { finish(); }
        else { render(); }
    }
    root.NetInformation = {
        init: function (translate) {
            t = translate;
            el('refresh').onclick = refresh;
            el('storage-device').onclick = function () { storageIndex = (storageIndex + 1) % data.storage.length; render(); };
        },
        refresh: refresh,
        render: render,
        cancel: cancel
    };
}(this));
