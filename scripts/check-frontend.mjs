import {readdirSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

// All browser scripts are checked, including workers and the administrator app.
const root = resolve('shiye-editorial-prototype');
const scripts = readdirSync(root).filter(name => name.endsWith('.js'));
const serverSource = readFileSync(resolve('server/app.ts'), 'utf8');
const publicEntries = serverSource.match(/const entries=new Set\(\[([\s\S]*?)\]\)/)?.[1] || '';
for (const name of scripts) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, name)], {encoding:'utf8'});
  if (result.status !== 0) { process.stderr.write(result.stderr); process.exit(1); }
}
for (const name of ['index.html', 'admin.html']) {
  const html = readFileSync(resolve(root, name), 'utf8');
  const sources = [...html.matchAll(/<script\s+[^>]*src="([^"]+)"/g)].map(match => match[1].replace(/^\//, ''));
  if (sources[0] !== 'api-client.js') throw Error(`${name}: API client must load before business scripts`);
  for (const source of sources) {
    readFileSync(resolve(root, source));
    if (!publicEntries.includes(`'/${source}'`)) throw Error(`${source}: missing server public-file entry`);
  }
}
console.log(`Frontend syntax and entry dependencies: ${scripts.length} scripts passed.`);
