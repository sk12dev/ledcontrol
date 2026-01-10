# Database Setup Guide - PostgreSQL for WLED Control Interface

## Overview

This guide covers installing and configuring PostgreSQL on Ubuntu for the WLED Control Interface React application.

## Why PostgreSQL?

- **Production-ready**: Battle-tested, reliable database system
- **Excellent JSON support**: Can store WLED state/config objects natively
- **Relational data**: Perfect for devices, presets, and future user management
- **Great ecosystem**: Works seamlessly with Node.js/TypeScript backends
- **Easy Ubuntu installation**: Well-supported on Ubuntu servers

## Installation Steps

### 1. Install PostgreSQL

```bash
# Update package list
sudo apt update

# Install PostgreSQL and common tools
sudo apt install postgresql postgresql-contrib -y

# Verify installation
sudo systemctl status postgresql
```

### 2. Initial Setup

```bash
# Switch to postgres user
sudo -i -u postgres

# Access PostgreSQL prompt
psql

# Create a database and user for your application
CREATE DATABASE wled_control;
CREATE USER wled_user WITH ENCRYPTED PASSWORD 'pass12345';
GRANT ALL PRIVILEGES ON DATABASE wled_control TO wled_user;

# For PostgreSQL 15+, also grant schema permissions
\c wled_control
GRANT ALL ON SCHEMA public TO wled_user;

# Exit psql
\q

# Exit postgres user
exit
```

### 3. Configure PostgreSQL (Optional but Recommended)

```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/*/main/postgresql.conf

# Adjust memory settings based on your server:
# shared_buffers = 256MB  (adjust based on available RAM)
# effective_cache_size = 1GB  (adjust based on available RAM)

# Configure connection settings in pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Ensure local connections are allowed (should already be set):
# local   all             all                                     peer
# host    all             all             127.0.0.1/32            md5
# host    all             all             ::1/128                 md5

# Restart PostgreSQL to apply changes
sudo systemctl restart postgresql
```

### 4. Test Connection

```bash
# Test connection from command line
psql -U wled_user -d wled_control -h localhost
# Enter password when prompted

# You should see:
# wled_control=>
```

## Node.js/Backend Integration

### Install PostgreSQL Client Library

```bash
# In your backend directory (you'll need to create this)
npm install pg
npm install @types/pg --save-dev

# Or use an ORM (recommended for TypeScript):
npm install typeorm pg reflect-metadata
# or
npm install prisma @prisma/client
```

## Recommended Schema (Example)

```sql
-- Devices table
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    mac_address VARCHAR(17),
    last_seen TIMESTAMP,
    device_info JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Presets table
CREATE TABLE presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    color INTEGER[] NOT NULL, -- [R, G, B, W]
    brightness INTEGER NOT NULL CHECK (brightness >= 1 AND brightness <= 255),
    device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
    user_id INTEGER, -- For future multi-user support
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User preferences (for future use)
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    default_device_id INTEGER REFERENCES devices(id),
    theme VARCHAR(50),
    preferences JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_devices_ip ON devices(ip_address);
CREATE INDEX idx_presets_device ON presets(device_id);
CREATE INDEX idx_presets_user ON presets(user_id);
```

## Security Best Practices

1. **Use strong passwords**: Generate a secure password for your database user
2. **Limit access**: Only allow connections from localhost unless necessary
3. **Regular backups**: Set up automated backups
   ```bash
   # Example backup script
   pg_dump -U wled_user -d wled_control > backup_$(date +%Y%m%d).sql
   ```
4. **Keep updated**: Regularly update PostgreSQL
   ```bash
   sudo apt update && sudo apt upgrade postgresql
   ```

## Maintenance Commands

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Stop PostgreSQL
sudo systemctl stop postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check status
sudo systemctl status postgresql

# Enable auto-start on boot
sudo systemctl enable postgresql

# Access PostgreSQL command line
sudo -u postgres psql

# Backup database
pg_dump -U wled_user -d wled_control > backup.sql

# Restore database
psql -U wled_user -d wled_control < backup.sql
```

## Windows GUI Management Tools

There are several excellent GUI tools for Windows that can connect to your remote PostgreSQL server:

### 1. **DBeaver Community Edition** (Recommended - Free & Open Source)

**Best for:** General database management, free and feature-rich

**Download:** [https://dbeaver.io/download/](https://dbeaver.io/download/)

**Pros:**

- Free and open-source
- Supports multiple database types (not just PostgreSQL)
- Powerful query editor with syntax highlighting
- Data visualization and export tools
- ER diagram generation
- Cross-platform (Windows, Mac, Linux)

**Installation:**

1. Download the Windows installer from the DBeaver website
2. Install using the installer (it's a standard Windows installer)
3. Launch DBeaver

**Connection Setup:**

1. Click "New Database Connection"
2. Select PostgreSQL
3. Enter connection details:
   - **Host:** `192.168.1.39` (your Ubuntu server IP)
   - **Port:** `5432` (default PostgreSQL port)
   - **Database:** `wled_control`
   - **Username:** `wled_user`
   - **Password:** `pass12345` (or your password)
4. Click "Test Connection" to verify
5. Click "Finish" to save

### 2. **pgAdmin 4** (Official PostgreSQL Tool)

**Best for:** PostgreSQL-specific features, official tool

**Download:** [https://www.pgadmin.org/download/pgadmin-4-windows/](https://www.pgadmin.org/download/pgadmin-4-windows/)

**Pros:**

- Official PostgreSQL administration tool
- Comprehensive PostgreSQL-specific features
- Built-in query tool
- Server monitoring and statistics
- Free and open-source

**Cons:**

- Can be resource-intensive
- Web-based interface (runs in browser)

**Installation:**

1. Download the Windows installer from pgAdmin website
2. Run the installer and follow the wizard
3. Launch pgAdmin (opens in your default browser)

**Connection Setup:**

1. Right-click "Servers" → "Create" → "Server"
2. General tab: Enter server name (e.g., "WLED Ubuntu Server")
3. Connection tab:
   - **Host name/address:** `192.168.1.39` (your Ubuntu server IP)
   - **Port:** `5432`
   - **Maintenance database:** `postgres`
   - **Username:** `wled_user`
   - **Password:** `pass12345` (or your password)
4. Click "Save"

### 3. **TablePlus** (Modern UI, Paid with Free Tier)

**Best for:** Beautiful modern interface, quick queries

**Download:** [https://tableplus.com/](https://tableplus.com/)

**Pros:**

- Beautiful, modern interface
- Very fast and lightweight
- Great for quick queries and data editing
- Supports multiple databases
- Free tier available (limited connections)

**Cons:**

- Free version limits number of tabs/connections
- Paid license required for advanced use

### 4. **DataGrip** (JetBrains IDE)

**Best for:** Professional development, SQL IDE features

**Download:** [https://www.jetbrains.com/datagrip/](https://www.jetbrains.com/datagrip/)

**Pros:**

- Powerful SQL IDE with code completion
- Advanced refactoring tools
- Excellent for complex queries
- Integration with other JetBrains tools

**Cons:**

- Paid software (free 30-day trial)
- More complex than needed for simple management

## Configuring PostgreSQL for Remote Connections

**Important:** Before connecting from Windows, you need to configure PostgreSQL to accept remote connections.

### Step 1: Configure PostgreSQL to Listen on Network Interface

```bash
# On your Ubuntu server (192.168.1.39), edit postgresql.conf
sudo nano /etc/postgresql/*/main/postgresql.conf

# Find and modify the listen_addresses line:
# Change from: listen_addresses = 'localhost'
# To: listen_addresses = '*'  (or specify your IP, e.g., '0.0.0.0')
# Or for better security, specify your Windows machine's IP
```

### Step 2: Allow Remote Connections in pg_hba.conf

```bash
# On your Ubuntu server (192.168.1.39), edit pg_hba.conf to allow connections
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Add a line at the end to allow connections from your local network:
# Replace YOUR_WINDOWS_IP with your actual Windows machine IP
# host    wled_control    wled_user    YOUR_WINDOWS_IP/32    md5

# Or allow from your entire local network (192.168.1.0/24):
host    wled_control    wled_user    192.168.1.0/24       md5

# Example for specific Windows machine IP (e.g., 192.168.1.50):
# host    wled_control    wled_user    192.168.1.50/32    md5
```

### Step 3: Restart PostgreSQL

```bash
sudo systemctl restart postgresql
```

### Step 4: Configure Firewall (if using UFW)

```bash
# On your Ubuntu server (192.168.1.39), allow PostgreSQL port
# Replace YOUR_WINDOWS_IP with your actual Windows machine IP
sudo ufw allow from YOUR_WINDOWS_IP to any port 5432

# Or allow from your entire local network (192.168.1.0/24):
sudo ufw allow from 192.168.1.0/24 to any port 5432

# Check firewall status
sudo ufw status
```

### Security Note for Remote Connections

**For Production/Internet-Exposed Servers:**

- **DO NOT** expose PostgreSQL directly to the internet
- Use SSH tunneling instead (see SSH Tunnel section below)
- Or use a VPN to connect securely

### Alternative: SSH Tunnel (Recommended for Security)

Instead of exposing PostgreSQL directly, use SSH tunneling:

**Using DBeaver:**

1. In connection settings, go to "SSH" tab
2. Enable "Use SSH Tunnel"
3. Enter:
   - **Host:** `192.168.1.39` (your Ubuntu server IP)
   - **Port:** `22`
   - **User Name:** Your Ubuntu username (e.g., `administrator`)
   - **Authentication:** Use password or private key
4. In "Main" tab, use:
   - **Host:** `localhost` (not server IP! The SSH tunnel handles the connection)
   - **Port:** `5432`
   - **Database:** `wled_control`
   - **Username:** `wled_user`
   - **Password:** `pass12345`

**Using pgAdmin:**

- Use SSH tunnel via PuTTY or similar tool
- Forward local port 5432 to server's localhost:5432
- Connect pgAdmin to `localhost:5432`

## Testing Remote Connection from Windows

```bash
# Using psql command line (if you have PostgreSQL client installed on Windows)
# Direct connection to server:
psql -h 192.168.1.39 -U wled_user -d wled_control

# Or using PowerShell/Command Prompt with SSH tunnel (more secure):
ssh -L 5432:localhost:5432 administrator@192.168.1.39
# Then in another terminal:
psql -h localhost -U wled_user -d wled_control
```

## Next Steps

1. Set up your backend API (Node.js/Express recommended to match your TypeScript stack)
2. Create database connection utilities
3. Implement API endpoints to replace localStorage functionality
4. Update your React app to use the backend API instead of localStorage
5. Migrate existing localStorage data to the database

## Resources

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/)
- [Node.js PostgreSQL Client (pg)](https://node-postgres.com/)
- [Prisma (TypeScript ORM)](https://www.prisma.io/)
- [TypeORM (TypeScript ORM)](https://typeorm.io/)
- [DBeaver Documentation](https://dbeaver.com/documentation/)
- [pgAdmin Documentation](https://www.pgadmin.org/docs/)
