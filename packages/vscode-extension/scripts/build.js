#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('Building Cairn VS Code Extension...');

// Build configurations
const builds = [
  {
    name: 'Extension',
    command: 'esbuild src/extension.ts --bundle --outfile=dist/src/extension.js --external:vscode --format=cjs --platform=node --sourcemap'
  },
  {
    name: 'Webview Index',
    command: 'esbuild src/components/index.tsx --bundle --outfile=media/index.js --jsx=automatic --external:vscode --format=iife --platform=browser --sourcemap'
  },
  {
    name: 'Webview Edit',
    command: 'esbuild src/components/edit.tsx --bundle --outfile=media/edit.js --jsx=automatic --external:vscode --format=iife --platform=browser --sourcemap'
  }
];

// Run builds sequentially for now (could be parallelized if needed)
try {
  for (const build of builds) {
    console.log(`\n📦 Building ${build.name}...`);
    execSync(build.command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log(`✅ ${build.name} built successfully`);
  }

  console.log('\n🎉 All builds completed successfully!');
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}