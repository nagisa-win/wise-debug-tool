const { spawn } = require('child_process');
const path = require('path');

function run(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  child.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(`Process ${cmd} exited with code ${code}`);
    }
  });
  return child;
}

const children = [];

function cleanup() {
  for (const p of children) {
    if (!p.killed) {
      p.kill('SIGINT');
    }
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

// 1) UI dev (vite in workspace via pnpm)
const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const uiDev = run(pnpmBin, ['-C', 'ui', 'run', 'dev']);
children.push(uiDev);

// 2) Webpack watch (root)
const webpackBin = path.resolve(__dirname, '../node_modules/.bin/webpack');
const webpackArgs = ['--mode', 'development', '--watch'];
const wp = run(webpackBin, webpackArgs);
children.push(wp);

// Keep process alive while children run
uiDev.on('exit', () => {});
wp.on('exit', () => {});
