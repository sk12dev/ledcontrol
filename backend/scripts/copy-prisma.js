import { readdirSync, statSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcDir = join(__dirname, '../dist/src/generated/prisma');
const destDir = join(__dirname, '../../src/generated/prisma');

if (!existsSync(srcDir)) {
  console.log('No compiled Prisma files found, skipping copy');
  process.exit(0);
}

// Create destination directory if it doesn't exist
mkdirSync(destDir, { recursive: true });

// Copy all .js files from compiled location to source location
const files = readdirSync(srcDir);
let copiedCount = 0;

files.forEach((file) => {
  const srcFile = join(srcDir, file);
  const destFile = join(destDir, file);
  
  if (statSync(srcFile).isFile() && file.endsWith('.js')) {
    copyFileSync(srcFile, destFile);
    copiedCount++;
  }
});

console.log(`Copied ${copiedCount} Prisma client JavaScript file(s) to ${destDir}`);
