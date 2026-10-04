# inet-speed-old-tizen

[Русская версия](README_RU.md)

An app for checking your internet connection with a Samsung Smart TV remote: site response times and download speed from test CDNs. Includes a Smart Hub icon and an English interface by default. Press OK in **Settings → Language** to switch between English and Russian; your choice is saved between launches. The entire interface switches language, including results, hints, and errors.

Tested on **Samsung UE50KU6000 (KU6000 series), Tizen 2.4.0, firmware T-JZL6DEUC-1260.1**. Installation, launch, and remote navigation were checked on this TV. Automated engine and interface checks use synthetic responses. The app uses ES5, with no runtime library dependencies, CSS Grid, or CSS custom properties. [Samsung lists WebKit r152340 for Tizen 2.4](https://developer.samsung.com/smarttv/develop/specifications/web-engine-specifications.html).

## Screenshots

Interface previews; displayed measurements are illustrative.

![Overview](docs/screenshots/overview.png)
![Speed servers and chart](docs/screenshots/speed.png)

## Download and installation

Download the ZIP from [Releases](https://github.com/numbereleven-a/inet-speed-old-tizen/releases/latest) and extract the WGT. The public package is unsigned: sign it with your Samsung certificate profile containing your TV's DUID before installation. Enable Developer Mode and connect the TV to Tizen Studio. Follow Samsung's [certificate](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html) and [TV connection](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html) guides. You can also build and sign the source using the commands below.

## Tests

- **Full test:** ten sites, followed by three speed servers tested one at a time.
- **Sites:** test all sites, a group, your own selection, or a single site. Sites outside the current group are dimmed and remain selectable. Includes Yandex, VK, Mail.ru, Rutube, RIA Novosti, Google, YouTube, Twitch, GitHub, and Wikipedia.
- **Speed:** Cloudflare, the independent HowFastly service running on Fastly, and HOSTKEY (Moscow). Test one server or all three. The CDN edge location depends on your network route.
- **Manual site:** open **Sites → Manual site → Enter address** to use the TV keyboard. Enter a domain or an HTTP/HTTPS website URL, then choose **Test site**. HTTPS is the default. The test requests `/favicon.ico` from the host; paths, queries, and fragments in the entered URL are ignored. Addresses are kept only for the session. Missing icons can cause a failed probe even when a website works.
- **Settings:** timeout of 2/3/5 seconds, 3/5 probes per site, speed test duration of 6/10/15 seconds, and a traffic budget of 8/32/64 MiB per server. Defaults: 3 seconds, 3 probes, 10 seconds, and 32 MiB.
- **Information:** a snapshot of the TV model, Tizen version, firmware, display resolution, system language, CPU load, active network, Wi-Fi name/signal/security, local IP, subnet mask, gateway, DNS, RAM, and user storage. Select **Refresh** to read again; select the storage button to cycle through available storage units. Reads stop after three seconds or when leaving the screen. Unsupported details show **Unavailable**. RAM covers the whole system; storage excludes system-reserved space. Wi-Fi standard and frequency are not exposed by the Tizen 2.4 APIs. Device and network details are not saved or transmitted.
- A failure stops further probes for that address and starts a 30-second cooldown. Testing continues with the next address. New runs skip an address during its cooldown; there are no automatic retries.

Arrow keys move focus; OK selects. Press OK on a site to open its individual test and add it to your selection. Return stops requests during a test. While entering an address, arrows and Backspace edit text; Done closes the keyboard. From Manual site, Return goes back to Sites. On other screens it returns to Overview; from Overview it opens the exit confirmation. Testing stops when the app goes into the background.

## What the app measures

Site response time measures how long it takes to load a small icon from the displayed domain over HTTPS. Rutube uses its static resource domain, `static.rtbcdn.ru`, shown on its card. The result is the median of successful probes. The first probe may include DNS, TCP, and TLS setup; later probes may reuse an existing connection. Variation is the mean absolute difference between consecutive successful probes. This is **not ICMP ping**, packet loss measurement, or a test of video playback or account login. Redirects and a site's CDN can also affect the result.

An icon loading error does not prove the entire site is unavailable. Possible causes include a timeout, TLS or certificate compatibility on an older TV, site protection, or a changed test resource. The app does not treat this as proof of blocking.

Download speed is received bytes divided by elapsed time from the start of the requests, including connection setup and pauses. Two requests run simultaneously, requesting at most 1 MiB each. Cloudflare and Fastly start with 256 KiB requests; HOSTKEY uses fixed 1 MiB LibreSpeed responses. Every response has a finite size, and its data is released after the request. Active requests are aborted when the duration or traffic budget is reached, an error occurs, or you stop the test. The budget limits requested response bodies; HTTP/TLS headers and other network overhead add some traffic beyond it. Total WebKit memory usage exceeds the combined size of the two bodies. A measurement shorter than 0.5 seconds is not accepted as a completed result.

The chart shows speed for each sampling interval; the final result is the average over the whole test.

The app does not save files, response contents, your IP address, or result history. Only preferences and selected site IDs are stored in localStorage. Results last until the app closes. A small traffic budget shortens the measurement on a fast connection. Speed depends on the TV's Wi-Fi/Ethernet connection, the server, the route, and the overhead of small requests. It estimates download speed from the selected CDN rather than guaranteeing your plan's advertised speed. This version does not measure upload speed.

Speed servers must allow CORS. The app uses finite `application/octet-stream` responses and validates their size: [Cloudflare Speedtest API](https://github.com/cloudflare/speedtest), [HowFastly](https://speed.edgecompute.app/), and [HOSTKEY speed test](https://speedtest.hostkey.ru/). Sites are checked through Image requests without requiring CORS. No proxy or separate application server is required.

## Development and packaging

Development requires Node.js and Tizen Studio with the Samsung TV Extension. Run these commands from the project root:

```text
npm ci
npm run check
npm test
```

Run the interface test with synthetic responses using `npm run test:ui`. It requires a Chromium browser installed by Playwright, or the path to your Chromium browser in the `BROWSER_EXECUTABLE` environment variable.

The syntax check requires ES5 throughout the application code. Tests use synthetic HTTP responses and timers to check timeouts, stopping retries, cancellation, traffic limits, request cleanup, and rejection of invalid data.

Package with the Tizen CLI from PowerShell:

```powershell
./scripts/package.ps1 -TizenCli tizen
```

Output: `artifacts/<version>/inet-speed-old-tizen-<version>-resign-required.wgt`. **This WGT is unsigned and must be signed before installing it on a TV.** Previous versions are preserved; an existing package of the same version is not overwritten.

To create a signed package, provide your certificate profile name:

```powershell
./scripts/package.ps1 -TizenCli tizen -CertificateProfile YOUR_CERTIFICATE_PROFILE
```

Enable Developer Mode, connect the TV to Tizen Studio, create a Samsung certificate profile containing the TV's DUID, import the WGT or source files, and sign the package for that device. See Samsung's instructions for [certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html), [connecting a TV](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html), and [importing an application](https://developer.samsung.com/smarttv/develop/getting-started/creating-tv-applications/importing-tv-applications.html). The app has its own package ID and installs separately from Twitch.

## License

[MIT](LICENSE).
