const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'app');
const files = [];
function walk(folder) {
  for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
    if (item.name === '.buildResult') continue;
    const file = path.join(folder, item.name);
    if (item.isDirectory()) walk(file);
    else files.push(file);
  }
}
walk(app);
for (const file of files) {
  if (file.endsWith('.js')) acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 5 });
  if (/\.(js|css|html|xml|svg)$/.test(file)) {
    const text = fs.readFileSync(file, 'utf8');
    if (/\b[A-Z]:[\\/]|\/Users\/|\/home\/|192\.168\.|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|(?:client_secret|access_token)\s*[:=]/i.test(text)) {
      throw new Error('Private data or a local path in ' + path.relative(root, file));
    }
  }
}
const css = fs.readFileSync(path.join(app, 'css', 'app.css'), 'utf8');
if (/\bdisplay\s*:\s*(?:inline-)?grid\b|(?:^|[\s;{])grid(?:-[a-z]+)*\s*:|backdrop-filter\s*:|var\(--|\bgap\s*:/m.test(css)) throw new Error('CSS requires a newer web engine');
const html = fs.readFileSync(path.join(app, 'index.html'), 'utf8');
const context = {};
vm.runInNewContext(fs.readFileSync(path.join(app, 'js', 'i18n.js'), 'utf8'), context);
const strings = context.NetStrings;
const keys = Object.keys(strings.en).sort();
if (keys.join() !== Object.keys(strings.ru).sort().join()) throw new Error('English and Russian translation keys differ');
for (const key of keys) {
  const slots = text => (text.match(/\{\w+\}/g) || []).sort().join();
  if (slots(strings.en[key]) !== slots(strings.ru[key])) throw new Error('Translation placeholders differ: ' + key);
}
for (const match of html.matchAll(/data-i18n="([^"]+)"/g)) {
  if (!keys.includes(match[1])) throw new Error('Missing translation: ' + match[1]);
}
function checkKey(node) {
  if (node.type === 'Literal' && typeof node.value === 'string' && !keys.includes(node.value)) throw new Error('Missing translation: ' + node.value);
  if (node.type === 'ConditionalExpression') { checkKey(node.consequent); checkKey(node.alternate); }
}
function checkStringCalls(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && ['t', 'footer'].includes(node.callee.name)) checkKey(node.arguments[0]);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(checkStringCalls);
    else if (value && typeof value === 'object') checkStringCalls(value);
  }
}
checkStringCalls(acorn.parse(fs.readFileSync(path.join(app, 'js', 'app.js'), 'utf8'), { ecmaVersion: 5 }));
for (const match of html.matchAll(/(?:src|href)="([^"#:]+)"/g)) {
  if (!fs.existsSync(path.join(app, match[1]))) throw new Error('Missing local resource: ' + match[1]);
}
const manifest = fs.readFileSync(path.join(app, 'config.xml'), 'utf8');
const metadata = require('../package.json');
if (!manifest.includes('<name>' + metadata.name + '</name>') || !manifest.includes('version="' + metadata.version + '"')) throw new Error('Package name/version differs from manifest');
if (!manifest.includes('required_version="2.4"')) throw new Error('Missing Tizen 2.4 target');
if (!html.includes('<span>v' + metadata.version + '</span>')) throw new Error('Sidebar version differs from package');
vm.runInNewContext(fs.readFileSync(path.join(app, 'js', 'targets.js'), 'utf8'), context);
const targets = context.NetTargets;
const access = [...manifest.matchAll(/<access\s+([^>]+)\/>/g)].map(match => ({
  origin: /origin="([^"]+)"/.exec(match[1])[1], subdomains: /subdomains="true"/.test(match[1])
}));
for (const target of [...targets.sites, ...targets.servers]) {
  const url = new URL(target.url);
  if (!access.some(rule => {
    if (rule.origin === '*') return true;
    const allowed = new URL(rule.origin);
    return url.protocol === allowed.protocol && url.port === allowed.port && (url.hostname === allowed.hostname || rule.subdomains && url.hostname.endsWith('.' + allowed.hostname));
  })) throw new Error('Missing manifest access: ' + target.id);
}
const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
const connect = csp.split(';').map(value => value.trim().split(/\s+/)).find(values => values[0] === 'connect-src') || [];
for (const server of targets.servers) {
  if (!connect.includes(new URL(server.url).origin)) throw new Error('Missing connect-src: ' + server.id);
  if (!keys.includes(server.note)) throw new Error('Missing server translation: ' + server.id);
}
const png = fs.readFileSync(path.join(app, 'icon.png'));
if (png.readUInt32BE(16) !== 512 || png.readUInt32BE(20) !== 512) throw new Error('Wrong launcher icon dimensions');
console.log('Checked ES5 syntax, legacy CSS, resources, translations, network access, versions, icon and private-data patterns.');
