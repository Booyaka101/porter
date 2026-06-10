# Porter MySQL & Authentication Setup

This document describes the MySQL database integration and user authentication system added to Porter.

## Features Added

### 1. MySQL Database Storage
- Full migration from JSON file storage to MySQL
- All data structures migrated: machines, scripts, history, scheduled jobs, bookmarks, notifications

### 2. User Authentication
- JWT-based authentication with secure token handling
- Login/logout functionality
- Password hashing with bcrypt
- Session management with cookies

### 3. Role-Based Access Control (RBAC)
Three built-in roles:
- **Admin**: Full system access (`*` permission)
- **Operator**: Can execute scripts, manage machines, view history
- **Viewer**: Read-only access to all resources

### 4. UI Updates
- Login page with modern design
- User profile menu in navigation
- User management page in Settings (admin only)
- Role-based UI visibility (write actions hidden for viewers)

## Environment Variables

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=porter
DB_PASSWORD=your_password
DB_NAME=porter

# Authentication
JWT_SECRET=your-secure-secret-key  # Optional, auto-generated if not set

# Enable MySQL mode
USE_MYSQL=true

# Run migration from JSON to MySQL (first run only)
MIGRATE_DATA=true
```

## Command Line Flags

```bash
# Enable MySQL mode
./porter -mysql

# Enable MySQL and migrate existing JSON data
./porter -mysql -migrate

# Other existing flags
./porter -port 8080 -open=false -portable
```

## Database Schema

The following tables are created automatically:

- `users` - User accounts
- `roles` - Role definitions with permissions
- `sessions` - Active user sessions
- `machines` - Machine configurations
- `execution_history` - Script execution history
- `scheduled_jobs` - Cron scheduled jobs
- `custom_scripts` - User-uploaded scripts
- `bookmarks` - Saved commands/scripts
- `notifications` - System notifications
- `notification_config` - Notification settings
- `health_cache` - Machine health data cache
- `audit_log` - Security audit trail

## Default Admin User

When MySQL mode is enabled and no users exist, a default admin is created:
- **Username**: `admin`
- **Password**: `admin`

**⚠️ Change this password immediately after first login!**

## Migration Process

1. Set up MySQL database:
```sql
CREATE DATABASE porter CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'porter'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON porter.* TO 'porter'@'localhost';
FLUSH PRIVILEGES;
```

2. Run Porter with migration:
```bash
DB_HOST=localhost DB_USER=porter DB_PASSWORD=your_password DB_NAME=porter \
  ./porter -mysql -migrate
```

3. After migration completes, restart without `-migrate` flag:
```bash
DB_HOST=localhost DB_USER=porter DB_PASSWORD=your_password DB_NAME=porter \
  ./porter -mysql
```

## Backward Compatibility

- Without `-mysql` flag, Porter continues to use JSON file storage
- Auth endpoints return 404 when MySQL is not enabled
- Frontend automatically detects auth mode and allows full access when auth is disabled

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/logout` - Logout and clear session
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/status` - Check authentication status
- `POST /api/auth/change-password` - Change password

### User Management (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `GET /api/users/{id}` - Get user details
- `PUT /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

### Roles
- `GET /api/roles` - List available roles

### Audit Log (Admin only)
- `GET /api/audit-log` - View security audit log

## Permissions

| Permission | Admin | Operator | Viewer |
|------------|-------|----------|--------|
| machines:read | ✓ | ✓ | ✓ |
| machines:write | ✓ | ✓ | ✗ |
| scripts:read | ✓ | ✓ | ✓ |
| scripts:execute | ✓ | ✓ | ✗ |
| history:read | ✓ | ✓ | ✓ |
| scheduler:read | ✓ | ✓ | ✓ |
| scheduler:write | ✓ | ✓ | ✗ |
| users:read | ✓ | ✗ | ✗ |
| users:write | ✓ | ✗ | ✗ |
