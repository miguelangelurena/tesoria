// Preserve the installed runtime dependencies' attribution texts in the web
// distribution. Does not decide ownership of Tesoria's name or artwork.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const entries = new Map();
for (const project of ['', 'client']) {
  const base = path.join(root, project);
  const lock = JSON.parse(await readFile(path.join(base, 'package-lock.json'), 'utf8'));
  for (const [location, info] of Object.entries(lock.packages)) {
    if (!location || info.dev) continue;
    const directory = path.join(base, location);
    const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
    const key = `${pkg.name}@${pkg.version}`;
    if (entries.has(key)) continue;
    const contents = await readdir(directory);
    const files = contents.filter((name) => /^(licen[sc]e|copying|notice)([.-]|$)/i.test(name)).sort();
    const texts = await Promise.all(files.map(async (name) => `${name}\n${await readFile(path.join(directory, name), 'utf8')}`));
    if (!texts.length) {
      for (const name of contents.filter((name) => /^readme([.-]|$)/i.test(name))) {
        const readme = await readFile(path.join(directory, name), 'utf8');
        const heading = /^#{1,3}\s+(?:licenses?|copyright)\b/im.exec(readme);
        if (heading) texts.push(`${name} (license section)\n${readme.slice(heading.index)}`);
      }
    }
    // This published package omits its own license file and contains vendored
    // D3 code. Preserve both the upstream version's license and embedded notices.
    if (pkg.name === 'victory-vendor' && pkg.version === '37.3.6') {
      texts.push(await readFile(path.join(root, 'scripts/license-notices/victory-vendor-37.3.6-LICENSE.txt'), 'utf8'));
      const vendorRoot = path.join(directory, 'lib-vendor');
      for (const vendor of (await readdir(vendorRoot)).sort()) {
        const vendorDir = path.join(vendorRoot, vendor);
        for (const file of (await readdir(vendorDir)).filter((name) => /^(license|notice)([.-]|$)/i.test(name)).sort()) {
          texts.push(`${vendor}/${file}\n${await readFile(path.join(vendorDir, file), 'utf8')}`);
        }
      }
    }
    if (!texts.length) throw new Error(`Review missing license text for ${key} before distributing`);
    entries.set(key, `${key}\nLicense metadata: ${pkg.license || info.license || 'See text below'}\n\n${texts.join('\n\n')}`);
  }
}
const notice = 'TESORIA — THIRD-PARTY SOFTWARE NOTICES\n\nRuntime dependencies from the root and client lockfiles. Original notices follow.\n\n' +
  [...entries].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value).join('\n\n' + '='.repeat(72) + '\n\n') + '\n';
await writeFile(path.join(root, 'client/public/THIRD_PARTY_NOTICES.txt'), notice);
console.log(`Preserved runtime notices for ${entries.size} packages.`);
