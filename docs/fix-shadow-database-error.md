# Fixing Prisma Shadow Database Error

## Problem

When running `npx prisma migrate dev`, you get:
```
Error: P3014
Prisma Migrate could not create the shadow database.
ERROR: permission denied to create database
```

## Why This Happens

Prisma Migrate uses a "shadow database" during development to validate migrations. Your database user (`wled_user`) doesn't have permission to create databases.

## Solutions

### Solution 1: Grant CREATEDB Permission (Recommended for Development)

On your Ubuntu server, grant permission to create databases:

```bash
# Connect as postgres superuser
sudo -u postgres psql

# Grant CREATEDB permission
ALTER USER wled_user CREATEDB;

# Exit
\q
```

Then try the migration again:
```bash
npx prisma migrate dev --name init
```

### Solution 2: Use prisma db push (Simpler, No Shadow Database)

Instead of migrations, use `db push` which doesn't require a shadow database:

```bash
npx prisma db push
```

**Note:** `db push` is simpler but doesn't create migration history files. Good for initial setup or development.

### Solution 3: Configure Shadow Database URL

Configure Prisma to use a specific shadow database by updating `prisma.config.ts`:

```typescript
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"], // Add this
  },
});
```

Then in your `.env` file, create a shadow database and add:
```env
DATABASE_URL="postgresql://wled_user:pass12345@192.168.1.39:5432/wled_control?schema=public"
SHADOW_DATABASE_URL="postgresql://wled_user:pass12345@192.168.1.39:5432/wled_control_shadow?schema=public"
```

On the server, create the shadow database:
```bash
sudo -u postgres psql
CREATE DATABASE wled_control_shadow;
GRANT ALL PRIVILEGES ON DATABASE wled_control_shadow TO wled_user;
\q
```

### Solution 4: Use Postgres Superuser (Not Recommended for Production)

Temporarily use the postgres superuser for migrations (not recommended):

```env
# In .env - NOT recommended for production
DATABASE_URL="postgresql://postgres:postgres_password@192.168.1.39:5432/wled_control?schema=public"
```

## Recommended Approach

For development, use **Solution 1** (grant CREATEDB) or **Solution 2** (db push).

For production, use **Solution 3** (configure shadow database) or handle migrations separately.

