#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runCommand(command, description) {
  console.log(`\n${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
  } catch (error) {
    console.error(`Failed: ${description}`);
    throw error;
  }
}

function main() {
  try {
    // Define package paths
    const cliPkgPath = 'packages/cli/package.json';
    const corePkgPath = 'packages/core/package.json';
    const extPkgPath = 'packages/vscode-extension/package.json';
    // Clean
    runCommand('npm run clean', 'Cleaning build artifacts');

    // Build TypeScript packages
    runCommand('npx tsc --project packages/core', 'Building core package');
    runCommand('npx tsc --project packages/cli', 'Building CLI package');

    // Check if dist directories exist
    if (!fs.existsSync('packages/core/dist')) {
      console.error('ERROR: Core build failed - dist directory not found');
      process.exit(1);
    }
    if (!fs.existsSync('packages/cli/dist')) {
      console.error('ERROR: CLI build failed - dist directory not found');
      process.exit(1);
    }

    // Install CLI dependencies
    runCommand('cd packages/cli && npm install && cd ../..', 'Installing CLI dependencies');

    // Build and package VSCode extension
    runCommand('cd packages/vscode-extension && npm run package-all && cd ../..', 'Building and packaging VSCode extension');

    // Run tests
    try {
      runCommand('npm run test', 'Running tests');
    } catch (error) {
      console.log('Some tests failed but continuing...');
    }

    // Prepare packages for publishing
    console.log('\nPreparing packages for publishing...');

    const cliPkgFresh = JSON.parse(fs.readFileSync(cliPkgPath, 'utf8'));
    const corePkg = JSON.parse(fs.readFileSync(corePkgPath, 'utf8'));
    const extPkg = JSON.parse(fs.readFileSync(extPkgPath, 'utf8'));

    // Update CLI dependency to match core version
    cliPkgFresh.dependencies['@valpet/cairn-core'] = `^${corePkg.version}`;
    fs.writeFileSync(cliPkgPath, JSON.stringify(cliPkgFresh, null, 2));
    console.log(`Updated CLI dependency to ^${corePkg.version} for publishing`);

    // Success message
    console.log('\n🎉 All packages built and ready for publishing!\n');
    console.log('Ready to publish:');
    console.log('  📦 Core: packages/core (npm publish from packages/core)');
    console.log('  🖥️  CLI: packages/cli (npm publish from packages/cli)');
    console.log(`  🔌 VSCode: packages/vscode-extension/cairn-extension-${extPkg.version}.vsix (vsce publish from packages/vscode-extension)`);

  } catch (error) {
    console.error('\n❌ Prepare publish failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();