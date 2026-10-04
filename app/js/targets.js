(function (root) {
    'use strict';
    root.NetTargets = {
        sites: [
            { id: 'yandex', name: 'Yandex', group: 'ru', host: 'yandex.ru', url: 'https://yandex.ru/favicon.ico', letter: 'Y', color: '#ed565e' },
            { id: 'vk', name: 'VK', group: 'ru', host: 'vk.com', url: 'https://vk.com/images/icons/favicons/fav_logo.ico', letter: 'VK', color: '#538fff' },
            { id: 'mail', name: 'Mail.ru', group: 'ru', host: 'mail.ru', url: 'https://mail.ru/favicon.ico', letter: '@', color: '#efb341' },
            { id: 'rutube', name: 'Rutube', group: 'ru', host: 'static.rtbcdn.ru', url: 'https://static.rtbcdn.ru/static/img/favicon-icons/v3/icon_180x180.png', letter: 'R', color: '#36b1cb' },
            { id: 'ria', name: 'RIA Novosti', group: 'ru', host: 'ria.ru', url: 'https://ria.ru/favicon.ico', letter: 'R', color: '#538fff' },
            { id: 'google', name: 'Google', group: 'world', host: 'google.com', url: 'https://www.google.com/favicon.ico', letter: 'G', color: '#6cbc9c' },
            { id: 'youtube', name: 'YouTube', group: 'world', host: 'youtube.com', url: 'https://www.youtube.com/favicon.ico', letter: 'Y', color: '#ed565e' },
            { id: 'twitch', name: 'Twitch', group: 'world', host: 'twitch.tv', url: 'https://www.twitch.tv/favicon.ico', letter: 'T', color: '#ab83f5' },
            { id: 'github', name: 'GitHub', group: 'world', host: 'github.com', url: 'https://github.com/favicon.ico', letter: 'GH', color: '#b6c4dd' },
            { id: 'wikipedia', name: 'Wikipedia', group: 'world', host: 'wikipedia.org', url: 'https://www.wikipedia.org/static/favicon/wikipedia.ico', letter: 'W', color: '#b6c4dd' }
        ],
        servers: [
            { id: 'cloudflare', name: 'Cloudflare', host: 'speed.cloudflare.com', url: 'https://speed.cloudflare.com/__down', note: 'serverCloudflare' },
            { id: 'fastly', name: 'Fastly · HowFastly', host: 'speed.edgecompute.app', url: 'https://speed.edgecompute.app/down', note: 'serverFastly' },
            { id: 'hostkey', name: 'HOSTKEY · Moscow', host: 'spd-rudp.hostkey.ru', url: 'https://spd-rudp.hostkey.ru/garbage', note: 'serverHostkey', librespeed: true }
        ]
    };
}(this));
