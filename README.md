# 📧 Professional Email Hosting System

A complete, production-ready email hosting solution with a beautiful webmail interface.

## 🚀 Features

- **Full Email Server**: Postfix + Dovecot
- **Webmail Interface**: Modern, clean, professional design
- **Admin Panel**: Manage domains, users, and settings
- **SSL/TLS Security**: Let's Encrypt integration
- **Spam Protection**: SpamAssassin + DKIM + SPF + DMARC
- **Database Backend**: MySQL/MariaDB for user management

## 📋 Requirements

- Ubuntu 20.04/22.04 LTS VPS
- Minimum 2GB RAM, 20GB Storage
- A domain name with DNS access
- Root/sudo access

## 🛠️ Quick Installation

### Step 1: Connect to your VPS
```bash
ssh root@your-server-ip
```

### Step 2: Download and run the installer
```bash
cd /opt
git clone https://github.com/yourusername/email-hosting.git
cd email-hosting
chmod +x install.sh
./install.sh
```

### Step 3: Follow the interactive prompts
The installer will ask for:
- Your domain name (e.g., mail.yourdomain.com)
- Admin email address
- MySQL root password

## 📁 Project Structure

```
email-hosting/
├── install.sh              # Main installation script
├── config/
│   ├── postfix/           # Postfix configuration
│   ├── dovecot/           # Dovecot configuration
│   └── nginx/             # Nginx configuration
├── webmail/               # Webmail frontend
├── api/                   # Backend API
├── admin/                 # Admin panel
└── scripts/               # Utility scripts
```

## 🌐 Access Points

After installation:
- **Webmail**: https://mail.yourdomain.com
- **Admin Panel**: https://mail.yourdomain.com/admin
- **SMTP**: mail.yourdomain.com:587 (STARTTLS)
- **IMAP**: mail.yourdomain.com:993 (SSL/TLS)

## 📞 Support

For issues and questions, create an issue in this repository.

---
Made with ❤️ for professional email hosting
