# Node.js Upgrade Guide for Windows

## Current Status

- **Your Current Version:** 18.19.1
- **Prisma Requirement:** 20.19+, 22.12+, or 24.0+
- **Recommended:** Node.js 20 LTS (Long Term Support)

## Option 1: Direct Download and Install (Recommended - Easiest)

### Step 1: Download Node.js 20 LTS

1. Go to [https://nodejs.org/](https://nodejs.org/)
2. Download the **LTS version** (20.x.x) - look for the green "Recommended For Most Users" button
3. Choose the **Windows Installer (.msi)** for your system (64-bit is standard)

### Step 2: Install Node.js

1. Run the downloaded `.msi` installer
2. Follow the installation wizard:
   - Accept the license agreement
   - Keep the default installation path (usually `C:\Program Files\nodejs\`)
   - **Important:** Check "Automatically install the necessary tools" if prompted
   - Click "Install"

### Step 3: Verify Installation

1. Close and reopen your terminal/PowerShell/Command Prompt
2. Run these commands to verify:
   ```bash
   node --version
   npm --version
   ```
   You should see:
   - Node.js version 20.x.x or higher
   - npm version (should update automatically)

### Step 4: Reinstall Dependencies

Since you upgraded Node.js, you should reinstall your project dependencies:

```bash
# Remove node_modules and package-lock.json
rm -r node_modules
rm package-lock.json

# Clear npm cache (optional but recommended)
npm cache clean --force

# Reinstall all dependencies
npm install
```

### Step 5: Install Prisma

Now you can install Prisma:

```bash
npm install prisma @prisma/client --save-dev
```

## Option 2: Using NVM for Windows (Recommended for Developers)

NVM (Node Version Manager) allows you to easily switch between multiple Node.js versions.

### Step 1: Download NVM for Windows

1. Go to [https://github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases)
2. Download `nvm-setup.exe` from the latest release
3. Run the installer and follow the wizard

### Step 2: Install Node.js 20 LTS

Open a new Command Prompt or PowerShell (as Administrator) and run:

```bash
# Install Node.js 20 LTS
nvm install 20.12.0

# Or install the latest 20.x LTS
nvm install 20

# Use the installed version
nvm use 20

# Verify installation
node --version
npm --version
```

### Step 3: Set as Default (Optional)

```bash
# Set Node.js 20 as default for all new terminals
nvm alias default 20
```

### Benefits of NVM:

- Switch between Node.js versions easily
- Keep multiple versions installed
- No need to uninstall/install when switching versions
- Great for working on multiple projects with different requirements

## Troubleshooting

### Issue: "node: command not found" after installation

**Solution:**

1. Restart your terminal/IDE completely
2. Check if Node.js is in your PATH:
   ```bash
   echo $env:PATH  # PowerShell
   echo %PATH%     # Command Prompt
   ```
3. Verify Node.js installation path: `C:\Program Files\nodejs\`
4. If not in PATH, add it manually in Windows Environment Variables

### Issue: npm commands not working

**Solution:**

```bash
# Reinstall npm globally
npm install -g npm@latest
```

### Issue: Permission errors

**Solution:**

- Run terminal/IDE as Administrator
- Or install Node.js in a directory you have full access to (not Program Files)

### Issue: Old version still showing

**Solution:**

1. Close ALL terminals, IDEs, and processes using Node.js
2. Restart your computer (sometimes Windows caches the PATH)
3. Verify with `node --version` in a fresh terminal

## After Upgrading

### 1. Update package.json (Optional but Recommended)

You can specify the Node.js version in your `package.json`:

```json
{
  "engines": {
    "node": ">=20.19.0",
    "npm": ">=10.0.0"
  }
}
```

### 2. Initialize Prisma

After installing Prisma, initialize it:

```bash
npx prisma init
```

This will create:

- `prisma/schema.prisma` - Your database schema
- `.env` - Environment variables (add your database connection string here)

### 3. Install Prisma Client

```bash
npm install @prisma/client
```

## Recommended Node.js Versions

- **Node.js 20 LTS** (Recommended)
  - Version: 20.12.0 or higher
  - LTS until April 2026
  - Stable and well-supported
- **Node.js 22 LTS** (If you want the latest)

  - Version: 22.12.0 or higher
  - LTS until April 2027
  - Newer features

- **Node.js 24** (Latest, not LTS)
  - Version: 24.0.0 or higher
  - Cutting edge features
  - Not recommended for production yet

## Quick Reference Commands

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Update npm to latest
npm install -g npm@latest

# List globally installed packages
npm list -g --depth=0

# Clear npm cache
npm cache clean --force

# Verify Prisma installation
npx prisma --version
```

## Resources

- [Node.js Official Website](https://nodejs.org/)
- [Node.js Downloads](https://nodejs.org/en/download/)
- [NVM for Windows](https://github.com/coreybutler/nvm-windows)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Node.js Release Schedule](https://github.com/nodejs/release#release-schedule)
