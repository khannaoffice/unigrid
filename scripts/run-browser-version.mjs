import { spawnSync } from 'node:child_process'

const version = process.argv[2]
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  throw new Error('Usage: node scripts/run-browser-version.mjs <react-version>')
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const result = spawnSync(npm, ['run', 'test:browser'], {
  env: { ...process.env, REACT_VERSION: version },
  stdio: 'inherit',
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
