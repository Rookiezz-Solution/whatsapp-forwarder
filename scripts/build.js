const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function rmIfExists(p) {
  try {
    await fs.promises.rm(p, { recursive: true, force: true });
  } catch (_) {}
}

async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.promises.copyFile(src, dest);
}

async function copyDir(src, dest) {
  await ensureDir(dest);
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isFile()) {
      await copyFile(s, d);
    }
  }
}

async function main() {
  console.log('[build] Starting build…');
  await rmIfExists(distDir);
  await ensureDir(distDir);

  // Copy app folders
  const folders = ['public', 'src'];
  for (const folder of folders) {
    const srcPath = path.join(projectRoot, folder);
    const destPath = path.join(distDir, folder);
    if (fs.existsSync(srcPath)) {
      console.log(`[build] Copying ${folder}/`);
      await copyDir(srcPath, destPath);
    }
  }

  // Copy data if present (e.g., messages.db)
  const dataSrc = path.join(projectRoot, 'data');
  if (fs.existsSync(dataSrc)) {
    console.log('[build] Copying data/');
    await copyDir(dataSrc, path.join(distDir, 'data'));
  }

  // Copy root files
  const files = ['config.js', 'config.json', 'README.md', 'package.json'];
  for (const file of files) {
    const srcFile = path.join(projectRoot, file);
    if (fs.existsSync(srcFile)) {
      console.log(`[build] Copying ${file}`);
      await copyFile(srcFile, path.join(distDir, file));
    }
  }

  console.log('[build] Build complete. To run:');
  console.log('        cd dist && npm start');
}

main().catch((err) => {
  console.error('[build] Build failed:', err);
  process.exit(1);
});