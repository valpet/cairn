#!/usr/bin/env node

/**
 * Version bump script for Cairn monorepo
 * Usage: node scripts/bump-version.js [package] [type]
 *
 * package: core, cli, extension, all (default: all)
 * type: minor, patch (default: patch)
 *
 * Examples:
 * - node scripts/bump-version.js core minor    # Bump core to 1.3.0
 * - node scripts/bump-version.js cli patch     # Bump cli to 1.2.4
 * - node scripts/bump-version.js all minor     # Bump all packages to 1.3.0
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const packages = {
  core: 'packages/core/package.json',
  cli: 'packages/cli/package.json',
  extension: 'packages/vscode-extension/package.json',
  root: 'package.json'
};

function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(version, type) {
  const v = parseVersion(version);
  switch (type) {
    case 'minor':
      return formatVersion({ ...v, minor: v.minor + 1, patch: 0 });
    case 'patch':
      return formatVersion({ ...v, patch: v.patch + 1 });
    default:
      throw new Error(`Unknown bump type: ${type}`);
  }
}

function readPackageJson(path) {
  return JSON.parse(readFileSync(join(rootDir, path), 'utf-8'));
}

function writePackageJson(path, data) {
  writeFileSync(join(rootDir, path), JSON.stringify(data, null, 2) + '\n');
}

function updateDependencies(pkg, newVersions) {
  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};

  let updated = false;

  // Update dependencies
  for (const [name, version] of Object.entries(deps)) {
    if (newVersions[name]) {
      // Skip file: dependencies for the extension
      if (typeof version === 'string' && version.startsWith('file:')) {
        continue;
      }
      const currentVersion = version.replace(/^\^/, '');
      if (currentVersion !== newVersions[name]) {
        deps[name] = `^${newVersions[name]}`;
        updated = true;
        console.log(`  Updated ${name}: ${version} -> ^${newVersions[name]}`);
      }
    }
  }

  // Update devDependencies
  for (const [name, version] of Object.entries(devDeps)) {
    if (newVersions[name]) {
      const currentVersion = version.replace(/^\^/, '');
      if (currentVersion !== newVersions[name]) {
        devDeps[name] = `^${newVersions[name]}`;
        updated = true;
        console.log(`  Updated ${name}: ${version} -> ^${newVersions[name]}`);
      }
    }
  }

  return updated;
}

function main() {
  const args = process.argv.slice(2);
  const targetPackage = args[0] || 'all';
  const bumpType = args[1] || 'patch';

  if (!['minor', 'patch'].includes(bumpType)) {
    console.error('Error: bump type must be "minor" or "patch"');
    process.exit(1);
  }

  const packagesToBump = targetPackage === 'all'
    ? ['root', 'core', 'cli', 'extension']
    : targetPackage === 'root'
    ? ['root']
    : [targetPackage];

  if (!packagesToBump.every(pkg => packages[pkg])) {
    console.error(`Error: unknown package "${targetPackage}". Available: root, core, cli, extension, all`);
    process.exit(1);
  }

  console.log(`Bumping ${bumpType} version for: ${packagesToBump.join(', ')}\n`);

  // Read current versions
  const currentVersions = {};
  for (const pkg of packagesToBump) {
    const packageJson = readPackageJson(packages[pkg]);
    currentVersions[pkg] = packageJson.version;
  }

  // Calculate new versions
  const newVersions = {};
  const packageNames = {
    root: 'cairn-monorepo',
    core: '@valpet/cairn-core',
    cli: '@valpet/cairn-cli',
    extension: 'cairn-extension'
  };

  // Use root version as canonical when bumping all
  let canonicalVersion;
  if (targetPackage === 'all') {
    const rootPackage = readPackageJson(packages.root);
    canonicalVersion = bumpVersion(rootPackage.version, bumpType);
  }

  for (const pkg of packagesToBump) {
    const packageJson = readPackageJson(packages[pkg]);
    const newVersion = canonicalVersion || bumpVersion(packageJson.version, bumpType);
    newVersions[packageNames[pkg]] = newVersion;
    console.log(`${pkg}: ${packageJson.version} -> ${newVersion}`);
  }

  console.log('\nUpdating package.json files...\n');

  // Update package versions and dependencies
  const allPackages = ['root', 'core', 'cli', 'extension'];

  for (const pkg of allPackages) {
    const path = packages[pkg];
    const packageJson = readPackageJson(path);

    // Update version if this package is being bumped
    if (packagesToBump.includes(pkg) && packageJson.version) {
      const oldVersion = packageJson.version;
      const newVersion = newVersions[packageNames[pkg]];
      packageJson.version = newVersion;
      console.log(`${path}: version ${oldVersion} -> ${newVersion}`);
    }

    // Update dependencies
    const depsUpdated = updateDependencies(packageJson, newVersions);

    if (packageJson.version || depsUpdated) {
      writePackageJson(path, packageJson);
    }
  }

  console.log('\n✅ Version bump complete!');
  console.log('\nNext steps:');
  console.log('1. Review the changes: git diff');
  console.log('2. Test the build: npm run build');
  console.log('3. Commit changes: git add -A && git commit -m "Bump version to ' + Object.values(newVersions)[0] + '"');
  console.log('4. Create tag: git tag v' + Object.values(newVersions)[0]);
  console.log('5. Push: git push && git push --tags');
}

main();