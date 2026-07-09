/**
 * @file sync-shared.js
 * @description 自动同步 /shared/ → client/assets/scripts/shared/
 *              仅复制 .ts 文件，保留 .meta 文件不变（Cocos Creator 资源 UUID）
 * @usage npm run sync:shared
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../shared');
const TARGET = path.resolve(__dirname, '../assets/scripts/shared');

const FILES = ['CardEncoding.ts', 'CardPattern.ts', 'PatternHelper.ts'];

console.log('[sync:shared] Syncing /shared/ → client/assets/scripts/shared/...');

// 验证目标目录存在
if (!fs.existsSync(TARGET)) {
  console.error(`  ✗ Target directory not found: ${TARGET}`);
  process.exit(1);
}

let syncedCount = 0;
const syncedFiles = [];

for (const file of FILES) {
  const src = path.join(SOURCE, file);
  const dest = path.join(TARGET, file);

  // 验证源文件存在
  if (!fs.existsSync(src)) {
    console.error(`  ✗ Source file not found: ${file}`);
    process.exit(1);
  }

  // 复制文件
  try {
    fs.copyFileSync(src, dest);
    syncedCount++;
    syncedFiles.push(file);
  } catch (err) {
    console.error(`  ✗ Failed to copy ${file}:`, err.message);
    process.exit(1);
  }
}

console.log(`  ✓ Synced ${syncedCount} files: ${syncedFiles.join(', ')}`);
console.log('[sync:shared] Done.');
