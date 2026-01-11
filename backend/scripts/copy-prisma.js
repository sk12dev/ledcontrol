import { readdirSync, statSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcDir = join(__dirname, '../dist/src/generated/prisma');
const destDir = join(__dirname, '../../src/generated/prisma');

if (!existsSync(srcDir)) {
  console.log('No compiled Prisma files found, skipping copy');
  process.exit(0);
}

// Recursively copy all .js files
function copyRecursive(src, dest) {
  if (!existsSync(src)) return 0;
  
  mkdirSync(dest, { recursive: true });
  let copiedCount = 0;
  
  const entries = readdirSync(src);
  
  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stats = statSync(srcPath);
    
    if (stats.isDirectory()) {
      // Recursively copy subdirectories
      copiedCount += copyRecursive(srcPath, destPath);
    } else if (stats.isFile() && entry.endsWith('.js')) {
      // Copy JavaScript files
      copyFileSync(srcPath, destPath);
      copiedCount++;
    }
  }
  
  return copiedCount;
}

const copiedCount = copyRecursive(srcDir, destDir);
console.log(`Copied ${copiedCount} Prisma client JavaScript file(s) to ${destDir}`);
