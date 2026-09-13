// Stage an explicit source allowlist locally. Never uploads or reads runtime secrets.
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = new Set(['package.json', 'package-lock.json', 'tsconfig.json', '.vefaasignore']);
const frontend = 'shiye-editorial-prototype';

async function regular(path) {
  const info = await lstat(join(root, path));
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`不是普通文件：${path}`);
}

async function addSources(directory) {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'tests') continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`不打包符号链接：${path}`);
    if (entry.isDirectory()) await addSources(path);
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.add(path);
  }
}

// Read the server's existing public-file sets as syntax; do not execute application code.
async function publicSet(path, name) {
  const source = ts.createSourceFile(path, await readFile(join(root, path), 'utf8'), ts.ScriptTarget.Latest, true);
  let values;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      if (values) throw new Error(`公开资源清单不唯一：${name}`);
      const initializer = node.initializer;
      const array = initializer && ts.isNewExpression(initializer) && initializer.expression.getText(source) === 'Set'
        && initializer.arguments?.length === 1 && initializer.arguments[0];
      if (!array || !ts.isArrayLiteralExpression(array) || !array.elements.every(ts.isStringLiteral)) {
        throw new Error(`公开资源清单结构已变化，请检查：${name}`);
      }
      values = array.elements.map(element => element.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!values) throw new Error(`找不到公开资源清单：${name}`);
  return values;
}

await addSources('server');
await addSources('shared');
for (const url of [...await publicSet('server/app.ts', 'entries'), ...await publicSet('server/room-home-files.ts', 'roomHomeFiles'), '/admin.html']) {
  const path = url === '/' ? 'index.html' : url.slice(1);
  if (!url.startsWith('/') || path.split('/').some(part => !part || part === '..' || part.startsWith('.'))) {
    throw new Error(`公开资源路径无效：${url}`);
  }
  files.add(`${frontend}/${path}`);
}
for (const entry of await readdir(join(root, frontend, 'assets'), { withFileTypes: true })) {
  if (/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/.test(entry.name)) files.add(`${frontend}/assets/${entry.name}`);
}
// Keep attribution documents even when they are not HTTP routes.
async function addLicenses(directory) {
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await addLicenses(path);
    else if (entry.isFile() && /^(license|licence|notice|attribution|credits)([.-]|$)/i.test(entry.name)) files.add(path);
  }
}
await addLicenses(frontend);
for (const path of files) {
  if (/(^|\/)(\.env[^/]*|\.local|archive|verification|node_modules|\.git)(\/|$)|\.(tar\.gz|zip|key|pem)$/i.test(path)) {
    throw new Error(`部署清单包含禁止文件：${path}`);
  }
  await regular(path);
}
const output = await mkdtemp(join(tmpdir(), 'shiye-deployment-'));
const source = join(output, 'source');
const manifest = [];
for (const path of [...files].sort()) {
  const target = join(source, path);
  if (relative(source, target).startsWith('..')) throw new Error('部署路径越界');
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, path), target);
  const bytes = await readFile(target);
  manifest.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await writeFile(join(output, 'manifest.json'), JSON.stringify({ createdAt: new Date().toISOString(), status: 'local-source-staging-only', files: manifest }, null, 2) + '\n');
console.log(JSON.stringify({ output, source, files: manifest.length, bytes: manifest.reduce((sum, file) => sum + file.bytes, 0), uploaded: false }, null, 2));
