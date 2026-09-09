const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

test('the packed package forwards to create-expo', async (t) => {
  const packageManager = process.env.SHIM_TEST_PACKAGE_MANAGER || 'npm';
  assert.ok(['npm', 'pnpm', 'yarn', 'bun'].includes(packageManager));
  const projectRoot = path.resolve(__dirname, '..');
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'create-expo-app test-'));
  t.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));

  // npm test supplies npm_execpath; invoking it with Node also works on Windows.
  assert.ok(process.env.npm_execpath, 'Run this test with npm test');
  const env = { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', NO_COLOR: '1' };
  // Let each package manager identify itself, rather than inherit npm test's identity.
  delete env.npm_config_user_agent;
  function run(command, args, cwd = temporaryRoot) {
    const result = spawnSync(command, args, {
      cwd,
      env,
      encoding: 'utf8',
      timeout: 120_000,
    });
    assert.ifError(result.error);
    return result;
  }
  function npm(args, cwd) {
    return run(process.execPath, [process.env.npm_execpath, ...args], cwd);
  }
  function passing(result) {
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout;
  }

  function pack(directory) {
    const packed = JSON.parse(passing(npm([
      'pack', '--json', '--pack-destination', temporaryRoot,
    ], directory)));
    // npm 12 returns a dictionary; earlier versions return an array.
    return (Array.isArray(packed) ? packed : Object.values(packed))[0];
  }
  const archive = pack(projectRoot);
  assert.deepEqual(archive.files.map(({ path }) => path).sort(), [
    'LICENSE', 'README.md', 'index.js', 'package.json',
  ]);

  writeFileSync(path.join(temporaryRoot, 'package.json'), JSON.stringify({
    name: 'shim-install-test', version: '1.0.0', private: true,
  }));
  const tarball = path.join(temporaryRoot, archive.filename);
  let yarnClassic = false;
  if (packageManager === 'npm') {
    passing(npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball]));
  } else if (packageManager === 'pnpm' || packageManager === 'bun') {
    passing(run(packageManager, ['add', '--ignore-scripts', tarball]));
  } else {
    const yarnVersion = passing(run('yarn', ['--version'])).trim();
    yarnClassic = yarnVersion.startsWith('1.');
    if (yarnClassic) {
      passing(run('yarn', ['add', '--ignore-scripts', tarball]));
    } else {
      writeFileSync(path.join(temporaryRoot, '.yarnrc.yml'),
        'nodeLinker: node-modules\nenableScripts: false\n');
      passing(run('yarn', ['add', `create-expo-app@file:${tarball}`]));
    }
  }

  // Resolve from the real entry point, including pnpm's isolated dependency tree.
  const installedEntry = require.resolve('create-expo-app', { paths: [temporaryRoot] });
  const coreMetadata = createRequire(installedEntry).resolve('create-expo/package.json');
  const coreVersion = JSON.parse(readFileSync(coreMetadata, 'utf8')).version;
  t.diagnostic(`Testing ${packageManager} with create-expo@${coreVersion}`);
  function cli(...args) {
    if (packageManager === 'npm') {
      return npm(['exec', '--offline', '--no', '--', 'create-expo-app', ...args]);
    }
    if (yarnClassic) {
      return run('yarn', ['--silent', 'exec', 'create-expo-app', '--', ...args]);
    }
    const command = packageManager === 'bun' ? 'run' : 'exec';
    return run(packageManager, [command, 'create-expo-app', ...args]);
  }

  await t.test('installed executable forwards help and version options', () => {
    assert.match(passing(cli('--help')), /npx create-expo/);
    assert.equal(passing(cli('--version')).trim(), coreVersion);
  });

  await t.test('package main forwards to the same CLI', () => {
    const launcher = path.join(temporaryRoot, 'require-main.cjs');
    writeFileSync(launcher, "require('create-expo-app');\n");
    assert.equal(passing(run(process.execPath, [launcher, '--version'])).trim(), coreVersion);
  });

  await t.test('project creation forwards a template path and skips installation', () => {
    const templateRoot = path.join(temporaryRoot, 'local template');
    mkdirSync(templateRoot);
    writeFileSync(path.join(templateRoot, 'package.json'), JSON.stringify({
      name: 'expo-template-shim-test', version: '1.0.0', private: true,
    }));
    writeFileSync(path.join(templateRoot, 'App.js'), 'export default function App() {}\n');
    const template = path.join(temporaryRoot, pack(templateRoot).filename);
    const projectName = 'generated-app';
    const output = passing(cli(projectName, '--template', template, '--no-install', '--yes'));
    const generatedRoot = path.join(temporaryRoot, projectName);
    const manifest = JSON.parse(readFileSync(path.join(generatedRoot, 'package.json'), 'utf8'));
    assert.equal(manifest.name, projectName);
    assert.equal(readFileSync(path.join(generatedRoot, 'App.js'), 'utf8'),
      'export default function App() {}\n');
    assert.equal(existsSync(path.join(generatedRoot, 'node_modules')), false);
    assert.match(output, new RegExp(`${packageManager} (?:run )?android`));
  });

  await t.test('invalid arguments retain a failing exit status', () => {
    const result = cli('--invalid-shim-option');
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /--invalid-shim-option/);
  });
});
