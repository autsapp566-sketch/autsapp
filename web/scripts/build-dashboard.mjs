import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = path.resolve(webRoot, '..', 'client');
const dist = path.join(clientRoot, 'dist');
const target = path.join(webRoot, 'public', 'dashboard');

// Vercel Root Directory is `web`, and files outside it are omitted unless the project
// setting "Include source files outside of the Root Directory" is on. The site must still build.
if (!fs.existsSync(path.join(clientRoot, 'package.json'))) {
  console.warn('Skipping dashboard embed: client app is not in this build (' + clientRoot + ').');
  console.warn('On Vercel, enable "Include source files outside of the Root Directory", then redeploy.');
  process.exit(0);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
if (!fs.existsSync(path.join(clientRoot, 'node_modules', 'vite'))) {
  const install = spawnSync(npm, ['ci'], { cwd: clientRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  if (install.status !== 0) process.exit(install.status ?? 1);
}

const env = { ...process.env, VITE_EMBEDDED: '1' };
delete env.VITE_ASSET_BASE;
const build = spawnSync(npm, ['run', 'build'], {
  cwd: clientRoot,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (build.status !== 0) process.exit(build.status ?? 1);

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(dist, target, { recursive: true });
if (!fs.existsSync(path.join(target, 'index.html'))) {
  console.error('Vite build did not produce index.html');
  process.exit(1);
}
console.log('dashboard copied to public/dashboard');
