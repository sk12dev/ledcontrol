# Fixing npm Permission Issues on Linux/Ubuntu

## Problem

You're trying to install npm packages in `/opt/ledcontrol/` but getting `EACCES: permission denied` errors. The `/opt/` directory typically requires root permissions.

## Solution Options

### Option 1: Fix Directory Ownership (Recommended)

Change the ownership of your project directory to your user account:

```bash
# Change ownership of the entire project directory to your user
sudo chown -R administrator:administrator /opt/ledcontrol

# Verify ownership changed
ls -la /opt/ledcontrol
```

Then try installing again:

```bash
npm install prisma @prisma/client --save-dev
```

### Option 2: Move Project to User Directory (Alternative)

If you prefer not to use `/opt/`, move your project to your home directory:

```bash
# Move project to home directory
mv /opt/ledcontrol ~/ledcontrol

# Or create a dedicated projects directory
mkdir -p ~/projects
mv /opt/ledcontrol ~/projects/ledcontrol

# Navigate to new location
cd ~/projects/ledcontrol  # or ~/ledcontrol

# Install dependencies
npm install prisma @prisma/client --save-dev
```

### Option 3: Fix Permissions Specifically for node_modules

If you want to keep the project in `/opt/` but just fix permissions:

```bash
# Give your user write permissions to the directory
sudo chmod -R u+w /opt/ledcontrol

# Or more specifically, ensure you own it
sudo chown -R $USER:$USER /opt/ledcontrol
```

## Verify Current Permissions

Check who owns the directory:

```bash
ls -la /opt/ | grep ledcontrol
```

You should see something like:

```
drwxr-xr-x   administrator administrator  ...
```

If you see `root root` or different ownership, that's the problem.

## After Fixing Permissions

1. **Navigate to your project directory:**

   ```bash
   cd /opt/ledcontrol  # or wherever your project is
   ```

2. **Verify you're in the right directory:**

   ```bash
   pwd
   ls -la  # Should see package.json
   ```

3. **Install Prisma:**

   ```bash
   npm install prisma @prisma/client --save-dev
   ```

4. **If you get errors about existing node_modules:**
   ```bash
   # Remove and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

## Common Issues and Solutions

### Issue: "Cannot find package.json"

**Solution:** Make sure you're in the project root directory:

```bash
cd /opt/ledcontrol
ls package.json  # Should exist
```

### Issue: Still getting permission errors after chown

**Solution:**

```bash
# Double-check ownership
ls -la /opt/ledcontrol

# If still wrong, use sudo
sudo chown -R $(whoami):$(whoami) /opt/ledcontrol

# Verify with your username
whoami  # Should match the owner
```

### Issue: "Cannot write to /opt/ledcontrol"

**Solution:** The `/opt/` directory itself might need permissions:

```bash
# Check /opt permissions
ls -ld /opt

# If needed, fix /opt/ledcontrol specifically
sudo chmod 755 /opt/ledcontrol
sudo chown -R administrator:administrator /opt/ledcontrol
```

## Best Practices

### For Development Projects

**Recommended:** Keep development projects in your home directory:

- `~/projects/ledcontrol`
- `~/dev/ledcontrol`
- `~/Development/ledcontrol`

This avoids permission issues and follows Linux conventions.

### For Production Projects

If this is a production deployment:

- Use a dedicated user account (e.g., `wledapp`)
- Set proper permissions: `sudo chown -R wledapp:wledapp /opt/ledcontrol`
- Run your application as that user (not root)

### Project Structure Recommendation

```
/home/administrator/
├── projects/
│   └── ledcontrol/
│       ├── my-react-app/        # Frontend (React app)
│       └── backend/              # Backend API (Node.js + Prisma)
└── ...
```

This keeps your development projects organized and avoids permission issues.

## Quick Fix Command (Copy & Paste)

Run this if you want to quickly fix permissions and stay in `/opt/`:

```bash
cd /opt/ledcontrol
sudo chown -R $(whoami):$(whoami) .
npm install prisma @prisma/client --save-dev
```

Or if you prefer moving to home directory:

```bash
cd ~
mkdir -p projects
sudo mv /opt/ledcontrol ~/projects/ledcontrol
cd ~/projects/ledcontrol
npm install prisma @prisma/client --save-dev
```

## Next Steps After Fixing Permissions

Once Prisma installs successfully:

1. **Initialize Prisma:**

   ```bash
   npx prisma init
   ```

2. **Configure your database connection in `.env`:**

   ```env
   DATABASE_URL="postgresql://wled_user:pass12345@localhost:5432/wled_control?schema=public"
   ```

3. **Create your schema in `prisma/schema.prisma`**

4. **Run migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

## Resources

- [npm Permissions Documentation](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally)
- [Linux File Permissions Guide](https://www.linux.com/training-tutorials/understanding-linux-file-permissions/)
