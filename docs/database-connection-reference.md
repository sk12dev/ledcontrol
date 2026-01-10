# Database Connection Quick Reference

## Server Information

- **PostgreSQL Server IP:** `192.168.1.39`
- **Port:** `5432`
- **Database Name:** `wled_control`
- **Username:** `wled_user`
- **Password:** `pass12345`

## Connection Strings

### For Prisma (.env file)

```env
DATABASE_URL="postgresql://wled_user:pass12345@192.168.1.39:5432/wled_control?schema=public"
```

### For Windows GUI Tools (DBeaver, pgAdmin)

**Direct Connection:**

- Host: `192.168.1.39`
- Port: `5432`
- Database: `wled_control`
- Username: `wled_user`
- Password: `pass12345`

**SSH Tunnel (More Secure):**

- SSH Host: `192.168.1.39`
- SSH Port: `22`
- SSH User: `administrator` (or your Ubuntu username)
- Database Host: `localhost` (when using tunnel)
- Database Port: `5432`
- Database: `wled_control`
- Username: `wled_user`
- Password: `pass12345`

### For Command Line (psql)

**Direct Connection:**

```bash
psql -h 192.168.1.39 -U wled_user -d wled_control
```

**SSH Tunnel:**

```bash
# First, create SSH tunnel in one terminal:
ssh -L 5432:localhost:5432 administrator@192.168.1.39

# Then, in another terminal, connect via localhost:
psql -h localhost -U wled_user -d wled_control
```

## Testing Connection

### From Windows (psql)

```bash
# If PostgreSQL client is installed on Windows
psql -h 192.168.1.39 -U wled_user -d wled_control -c "SELECT version();"
```

### From Ubuntu Server

```bash
# From the server itself
psql -U wled_user -d wled_control -h localhost -c "SELECT version();"
```

### Using Prisma

```bash
# Test Prisma connection
npx prisma db pull
```

## Troubleshooting

### Connection Refused

- Verify PostgreSQL is running: `sudo systemctl status postgresql` (on server)
- Check firewall allows port 5432
- Verify `listen_addresses` in `postgresql.conf` is not set to `localhost` only

### Authentication Failed

- Verify username and password are correct
- Check `pg_hba.conf` allows connections from your IP
- Ensure database user exists: `sudo -u postgres psql -c "\du"`

### Network Unreachable

- Verify server IP (192.168.1.39) is correct and reachable
- Test with: `ping 192.168.1.39`
- Check if both machines are on same network (192.168.1.x)
