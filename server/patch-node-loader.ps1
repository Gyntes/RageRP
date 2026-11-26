$ErrorActionPreference = 'Stop'

$ServerFiles = $args[0]
if (-not $ServerFiles) {
  throw 'ServerFiles argument is required.'
}
$serverFiles = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ServerFiles)
$binDirectory = Join-Path $serverFiles 'bin'
$loaderPath = Join-Path $binDirectory 'loader.mjs'

New-Item -ItemType Directory -Force -Path $binDirectory | Out-Null

$loader = @'
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

console.log('\x1b[33m[INFO]\x1b[0m Loading NodeJS packages...');

const require = createRequire(import.meta.url);
const packageDirectory = path.resolve(process.cwd(), 'packages');
for (const name of fs.readdirSync(packageDirectory).filter((file) => {
  return fs.statSync(path.join(packageDirectory, file)).isDirectory();
})) {
  try {
    const packagePath = path.join(packageDirectory, name);
    if (fs.existsSync(path.join(packagePath, 'index.js'))) {
      require(path.join(packagePath, 'index.js'));
    } else if (fs.existsSync(path.join(packagePath, 'index.mjs'))) {
      await import(pathToFileURL(path.join(packagePath, 'index.mjs')));
    } else {
      throw new Error('Neither index.js nor index.mjs was found.');
    }
    console.log(`\x1b[32m[DONE]\x1b[0m "${name}" package has been loaded.`);
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m "${name}" package loading failed:\n${error.stack}\n`);
  }
}

if (typeof globalThis.mp !== 'undefined' && mp.events && typeof mp.events.getAllOf === 'function') {
  console.log('\x1b[33m[INFO]\x1b[0m Starting packages...');
  mp.events.initialized = true;
}

console.log('\x1b[32m[DONE]\x1b[0m Server package loading completed.');
'@

[System.IO.File]::WriteAllText(
  $loaderPath,
  $loader,
  (New-Object System.Text.UTF8Encoding($false))
)
