(function (root) {
    'use strict';
    // Public DoH endpoints: https://github.com/DNSCrypt/dnscrypt-resolvers
    root.NetDNSExtended = [
    {
        "name": "Google",
        "url": "https://dns.google/dns-query"
    },
    {
        "name": "Cloudflare",
        "url": "https://cloudflare-dns.com/dns-query"
    },
    {
        "name": "Quad9",
        "url": "https://dns.quad9.net/dns-query"
    },
    {
        "name": "Yandex",
        "url": "https://common.dot.dns.yandex.net/dns-query"
    },
    {
        "name": "AdGuard",
        "url": "https://dns.adguard-dns.com/dns-query"
    },
    {
        "name": "Control D",
        "url": "https://freedns.controld.com/p0"
    },
    {
        "name": "OpenDNS",
        "url": "https://doh.opendns.com/dns-query"
    },
    {
        "name": "CleanBrowsing",
        "url": "https://doh.cleanbrowsing.org/doh/security-filter/"
    },
    {
        "name": "DNS.SB",
        "url": "https://doh.dns.sb/dns-query"
    },
    {
        "name": "AliDNS",
        "url": "https://dns.alidns.com/dns-query"
    },
    {
        "name": "a-and-a",
        "url": "https://dns.aa.net.uk/dns-query"
    },
    {
        "name": "adfilter-adl",
        "url": "https://adl.adfilter.net/dns-query"
    },
    {
        "name": "adfilter-per",
        "url": "https://per.adfilter.net/dns-query"
    },
    {
        "name": "adfilter-syd",
        "url": "https://syd.adfilter.net/dns-query"
    },
    {
        "name": "adguard-dns-family",
        "url": "https://family.adguard-dns.com/dns-query"
    },
    {
        "name": "adguard-dns-unfiltered",
        "url": "https://unfiltered.adguard-dns.com/dns-query"
    },
    {
        "name": "artikel10",
        "url": "https://dns.artikel10.org/dns-query"
    },
    {
        "name": "blahdns-de",
        "url": "https://doh-de.blahdns.com/dns-query"
    },
    {
        "name": "bortzmeyer",
        "url": "https://doh.bortzmeyer.fr/"
    },
    {
        "name": "cira-family",
        "url": "https://family.canadianshield.cira.ca/dns-query"
    },
    {
        "name": "cira-private",
        "url": "https://private.canadianshield.cira.ca/dns-query"
    },
    {
        "name": "cira-protected",
        "url": "https://protected.canadianshield.cira.ca/dns-query"
    },
    {
        "name": "circl",
        "url": "https://dns.circl.lu/dns-query"
    },
    {
        "name": "cleanbrowsing-adult",
        "url": "https://cleanbrowsing.org/doh/adult-filter"
    },
    {
        "name": "cleanbrowsing-family",
        "url": "https://cleanbrowsing.org/doh/family-filter"
    },
    {
        "name": "cleanbrowsing-security",
        "url": "https://cleanbrowsing.org/doh/security-filter"
    },
    {
        "name": "cloudflare",
        "url": "https://dns.cloudflare.com/dns-query"
    },
    {
        "name": "comss.one",
        "url": "https://dns.comss.one/dns-query"
    },
    {
        "name": "controld-block-malware",
        "url": "https://freedns.controld.com/p1"
    },
    {
        "name": "controld-block-malware-ad",
        "url": "https://freedns.controld.com/p2"
    },
    {
        "name": "controld-block-malware-ad-social",
        "url": "https://freedns.controld.com/p3"
    },
    {
        "name": "controld-family-friendly",
        "url": "https://freedns.controld.com/family"
    },
    {
        "name": "controld-uncensored",
        "url": "https://freedns.controld.com/uncensored"
    },
    {
        "name": "dns.digitale-gesellschaft.ch",
        "url": "https://dns.digitale-gesellschaft.ch/dns-query"
    },
    {
        "name": "dns.digitalsize.net",
        "url": "https://dns.digitalsize.net/dns-query"
    },
    {
        "name": "dns4all",
        "url": "https://doh.dns4all.eu/dns-query"
    },
    {
        "name": "dns4all",
        "url": "https://doh64.dns4all.eu/dns-query"
    },
    {
        "name": "dns4eu",
        "url": "https://unfiltered.joindns4.eu/dns-query"
    },
    {
        "name": "dns4eu-protective",
        "url": "https://protective.joindns4.eu/dns-query"
    },
    {
        "name": "dnsbunker",
        "url": "https://dnsbunker.org/dns-query"
    },
    {
        "name": "dnscrypt.ca",
        "url": "https://dns1.dnscrypt.ca/dns-query"
    },
    {
        "name": "dnsforfamily",
        "url": "https://dns-doh.dnsforfamily.com/dns-query"
    },
    {
        "name": "dnsforfamily-no-safe-search",
        "url": "https://dns-doh-no-safe-search.dnsforfamily.com/dns-query"
    },
    {
        "name": "dnsforge.de",
        "url": "https://dnsforge.de/dns-query"
    },
    {
        "name": "dnsforge.de-nofilter",
        "url": "https://blank.dnsforge.de/dns-query"
    },
    {
        "name": "dnshome-de",
        "url": "https://dns.dnshome.de/dns-query"
    },
    {
        "name": "dnslow.me",
        "url": "https://dnslow.me/dns-query"
    },
    {
        "name": "doh-cleanbrowsing-adult",
        "url": "https://doh.cleanbrowsing.org/doh/adult-filter/"
    },
    {
        "name": "doh-cleanbrowsing-family",
        "url": "https://doh.cleanbrowsing.org/doh/family-filter/"
    },
    {
        "name": "doh-crypto-sx",
        "url": "https://doh.crypto.sx/dns-query"
    },
    {
        "name": "doh-crypto-sx",
        "url": "https://doh-ipv6.crypto.sx/dns-query"
    },
    {
        "name": "doh.appliedprivacy.net",
        "url": "https://doh.appliedprivacy.net/query"
    },
    {
        "name": "doh.ffmuc.net",
        "url": "https://doh.ffmuc.net/dns-query"
    },
    {
        "name": "doh.ibksturm",
        "url": "https://ibksturm.synology.me/dns-query"
    },
    {
        "name": "doh.tiar.app",
        "url": "https://doh.tiar.app/dns-query"
    },
    {
        "name": "doh.tiarap.org",
        "url": "https://doh.tiarap.org/dns-query"
    },
    {
        "name": "dremaxx",
        "url": "https://open.dns.dremaxx.com/dns-query"
    },
    {
        "name": "dremaxx-family",
        "url": "https://family.dns.dremaxx.com/dns-query"
    },
    {
        "name": "ekinao",
        "url": "https://dns.ekinao.com/dns-query"
    },
    {
        "name": "fdn",
        "url": "https://ns1.fdn.fr/dns-query"
    },
    {
        "name": "fdn",
        "url": "https://ns0.fdn.fr/dns-query"
    },
    {
        "name": "he",
        "url": "https://ordns.he.net/dns-query"
    },
    {
        "name": "iij",
        "url": "https://public.dns.iij.jp/dns-query"
    },
    {
        "name": "la-contre-voie",
        "url": "https://doh.lacontrevoie.fr/dns-query"
    },
    {
        "name": "libredns",
        "url": "https://doh.libredns.gr/dns-query"
    },
    {
        "name": "libredns-noads",
        "url": "https://doh.libredns.gr/noads"
    },
    {
        "name": "mullvad-adblock",
        "url": "https://adblock.dns.mullvad.net/dns-query"
    },
    {
        "name": "mullvad-all",
        "url": "https://all.dns.mullvad.net/dns-query"
    },
    {
        "name": "mullvad-base",
        "url": "https://base.dns.mullvad.net/dns-query"
    },
    {
        "name": "mullvad",
        "url": "https://dns.mullvad.net/dns-query"
    },
    {
        "name": "mullvad-extend",
        "url": "https://extended.dns.mullvad.net/dns-query"
    },
    {
        "name": "mullvad-family",
        "url": "https://family.dns.mullvad.net/dns-query"
    },
    {
        "name": "nextdns",
        "url": "https://anycast.dns.nextdns.io/dns-query"
    },
    {
        "name": "nextdns-ultralow",
        "url": "https://dns.nextdns.io/dnscrypt-proxy"
    },
    {
        "name": "nic.cz",
        "url": "https://odvr.nic.cz/dns-query"
    },
    {
        "name": "njalla",
        "url": "https://dns.njal.la/dns-query"
    },
    {
        "name": "olilo",
        "url": "https://dns.as212683.net/dns-query"
    },
    {
        "name": "pidoh-mapledns",
        "url": "https://pidoh.mapledns.net/dns-query"
    },
    {
        "name": "plan9dns-mx",
        "url": "https://helios.plan9-dns.com/dns-query"
    },
    {
        "name": "qihoo360",
        "url": "https://doh.360.cn/dns-query"
    },
    {
        "name": "quad9-ip4-port443-filter-ecs-pri",
        "url": "https://dns11.quad9.net/dns-query"
    },
    {
        "name": "quad9-ip4-port443-filter-pri",
        "url": "https://dns9.quad9.net/dns-query"
    },
    {
        "name": "quad9-ip4-port443-nofilter-ecs-pri",
        "url": "https://dns12.quad9.net/dns-query"
    },
    {
        "name": "quad9-ip4-port443-nofilter-pri",
        "url": "https://dns10.quad9.net/dns-query"
    },
    {
        "name": "restena",
        "url": "https://dnspub.restena.lu/dns-query"
    },
    {
        "name": "rethinkdns",
        "url": "https://sky.rethinkdns.com/dns-query"
    },
    {
        "name": "rethinkdns",
        "url": "https://max.rethinkdns.com/dns-query"
    },
    {
        "name": "safesurfer",
        "url": "https://doh.safesurfer.io/dns-query"
    },
    {
        "name": "safesurfer-secondary",
        "url": "https://dns.safesurfer.co.nz/dns-query"
    },
    {
        "name": "uncensoreddns-dk",
        "url": "https://unicast.uncensoreddns.org/dns-query"
    },
    {
        "name": "uncensoreddns",
        "url": "https://anycast.uncensoreddns.org/dns-query"
    },
    {
        "name": "wikimedia",
        "url": "https://wikimedia-dns.org/dns-query"
    },
    {
        "name": "yunzheng",
        "url": "https://dns.yunzheng.space/dns-query"
    },
    {
        "name": "yunzheng-dns64",
        "url": "https://dns64.dns.yunzheng.space/dns-query"
    },
    {
        "name": "yunzheng-filtered",
        "url": "https://filter.dns.yunzheng.space/dns-query"
    },
    {
        "name": "dnscry.pt-adelaide",
        "url": "https://adl01.dnscry.pt/dns-query"
    },
    {
        "name": "dnscry.pt-allendale",
        "url": "https://aqx01.dnscry.pt/dns-query"
    },
    {
        "name": "dnscry.pt-allentown",
        "url": "https://abe01.dnscry.pt/dns-query"
    },
    {
        "name": "dnscry.pt-amsterdam",
        "url": "https://ams01.dnscry.pt/dns-query"
    },
    {
        "name": "dnscry.pt-amsterdam02",
        "url": "https://ams02.dnscry.pt/dns-query"
    }
];
}(this));
