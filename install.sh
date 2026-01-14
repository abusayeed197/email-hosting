#!/bin/bash

#################################################
#  Professional Email Hosting Installation Script
#  Supports: Ubuntu 20.04/22.04 LTS
#################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
clear
echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║     📧 Professional Email Hosting System Installer          ║"
echo "║                                                              ║"
echo "║     Version: 1.0.0                                          ║"
echo "║     Author: Email Hosting Pro                               ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Please run as root (sudo ./install.sh)${NC}"
    exit 1
fi

# Check OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo -e "${RED}❌ Cannot detect OS. This script supports Ubuntu 20.04/22.04${NC}"
    exit 1
fi

if [ "$OS" != "ubuntu" ]; then
    echo -e "${RED}❌ This script only supports Ubuntu. Detected: $OS${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Detected: Ubuntu $VERSION${NC}"
echo ""

# Get configuration from user
echo -e "${CYAN}📝 Please provide the following information:${NC}"
echo ""

read -p "Enter your mail domain (e.g., mail.example.com): " MAIL_DOMAIN
read -p "Enter your base domain (e.g., example.com): " BASE_DOMAIN
read -p "Enter admin email address: " ADMIN_EMAIL
read -sp "Enter MySQL root password: " MYSQL_ROOT_PASS
echo ""
read -sp "Enter password for mail database: " MAIL_DB_PASS
echo ""

# Validate inputs
if [ -z "$MAIL_DOMAIN" ] || [ -z "$BASE_DOMAIN" ] || [ -z "$ADMIN_EMAIL" ] || [ -z "$MYSQL_ROOT_PASS" ] || [ -z "$MAIL_DB_PASS" ]; then
    echo -e "${RED}❌ All fields are required!${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 Configuration Summary:${NC}"
echo "   Mail Domain: $MAIL_DOMAIN"
echo "   Base Domain: $BASE_DOMAIN"
echo "   Admin Email: $ADMIN_EMAIL"
echo ""
read -p "Is this correct? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "Installation cancelled."
    exit 1
fi

# Create installation log
LOG_FILE="/var/log/email-hosting-install.log"
exec 1> >(tee -a "$LOG_FILE") 2>&1

echo ""
echo -e "${BLUE}🚀 Starting installation...${NC}"
echo ""

#################################################
# Step 1: System Update
#################################################
echo -e "${CYAN}[1/12] Updating system packages...${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}✅ System updated${NC}"

#################################################
# Step 2: Install required packages
#################################################
echo -e "${CYAN}[2/12] Installing required packages...${NC}"
DEBIAN_FRONTEND=noninteractive apt install -y \
    postfix \
    postfix-mysql \
    dovecot-core \
    dovecot-imapd \
    dovecot-pop3d \
    dovecot-lmtpd \
    dovecot-mysql \
    mariadb-server \
    mariadb-client \
    nginx \
    php8.1-fpm \
    php8.1-mysql \
    php8.1-imap \
    php8.1-mbstring \
    php8.1-xml \
    php8.1-curl \
    php8.1-zip \
    php8.1-intl \
    php8.1-gd \
    certbot \
    python3-certbot-nginx \
    spamassassin \
    spamc \
    opendkim \
    opendkim-tools \
    nodejs \
    npm \
    git \
    unzip \
    wget \
    curl

echo -e "${GREEN}✅ Packages installed${NC}"

#################################################
# Step 3: Configure MySQL/MariaDB
#################################################
echo -e "${CYAN}[3/12] Configuring database...${NC}"

# Secure MySQL installation
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$MYSQL_ROOT_PASS';"
mysql -u root -p"$MYSQL_ROOT_PASS" -e "DELETE FROM mysql.user WHERE User='';"
mysql -u root -p"$MYSQL_ROOT_PASS" -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
mysql -u root -p"$MYSQL_ROOT_PASS" -e "DROP DATABASE IF EXISTS test;"
mysql -u root -p"$MYSQL_ROOT_PASS" -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
mysql -u root -p"$MYSQL_ROOT_PASS" -e "FLUSH PRIVILEGES;"

# Create mail database
mysql -u root -p"$MYSQL_ROOT_PASS" << EOF
CREATE DATABASE IF NOT EXISTS mailserver;
CREATE USER IF NOT EXISTS 'mailuser'@'localhost' IDENTIFIED BY '$MAIL_DB_PASS';
GRANT ALL PRIVILEGES ON mailserver.* TO 'mailuser'@'localhost';
FLUSH PRIVILEGES;

USE mailserver;

CREATE TABLE IF NOT EXISTS virtual_domains (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS virtual_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    domain_id INT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    quota BIGINT DEFAULT 1073741824,
    is_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    FOREIGN KEY (domain_id) REFERENCES virtual_domains(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS virtual_aliases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    domain_id INT NOT NULL,
    source VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (domain_id) REFERENCES virtual_domains(id) ON DELETE CASCADE
);

-- Insert default domain
INSERT INTO virtual_domains (name) VALUES ('$BASE_DOMAIN') ON DUPLICATE KEY UPDATE name=name;

-- Get domain ID and create admin user
SET @domain_id = (SELECT id FROM virtual_domains WHERE name = '$BASE_DOMAIN');
INSERT INTO virtual_users (domain_id, email, password, first_name, last_name, is_admin)
VALUES (@domain_id, '$ADMIN_EMAIL', ENCRYPT('admin123', CONCAT('\$6\$', SUBSTRING(SHA(RAND()), -16))), 'Admin', 'User', TRUE)
ON DUPLICATE KEY UPDATE email=email;
EOF

echo -e "${GREEN}✅ Database configured${NC}"

#################################################
# Step 4: Configure Postfix
#################################################
echo -e "${CYAN}[4/12] Configuring Postfix...${NC}"

# Backup original config
cp /etc/postfix/main.cf /etc/postfix/main.cf.backup

cat > /etc/postfix/main.cf << EOF
# Basic Configuration
smtpd_banner = \$myhostname ESMTP
biff = no
append_dot_mydomain = no
readme_directory = no
compatibility_level = 2

# TLS parameters
smtpd_tls_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file=/etc/ssl/private/ssl-cert-snakeoil.key
smtpd_tls_security_level = may
smtpd_tls_auth_only = yes
smtpd_tls_loglevel = 1
smtpd_tls_received_header = yes
smtpd_tls_session_cache_timeout = 3600s
smtpd_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1
smtpd_tls_mandatory_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1

smtp_tls_CApath=/etc/ssl/certs
smtp_tls_security_level = may
smtp_tls_session_cache_database = btree:\${data_directory}/smtp_scache
smtp_tls_loglevel = 1

# Network Configuration
myhostname = $MAIL_DOMAIN
myorigin = /etc/mailname
mydestination = localhost
relayhost =
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
inet_protocols = all

# Virtual Mailbox Configuration
virtual_transport = lmtp:unix:private/dovecot-lmtp
virtual_mailbox_domains = mysql:/etc/postfix/mysql-virtual-mailbox-domains.cf
virtual_mailbox_maps = mysql:/etc/postfix/mysql-virtual-mailbox-maps.cf
virtual_alias_maps = mysql:/etc/postfix/mysql-virtual-alias-maps.cf

# SASL Authentication
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes
smtpd_sasl_security_options = noanonymous
smtpd_sasl_local_domain = \$myhostname
broken_sasl_auth_clients = yes

# Restrictions
smtpd_helo_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_invalid_helo_hostname
smtpd_sender_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unknown_sender_domain
smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination, reject_unknown_recipient_domain

# Message Size Limit (50MB)
message_size_limit = 52428800

# Milter configuration for DKIM
milter_protocol = 6
milter_default_action = accept
smtpd_milters = inet:localhost:8891
non_smtpd_milters = inet:localhost:8891
EOF

echo "$MAIL_DOMAIN" > /etc/mailname

# MySQL lookup tables for Postfix
cat > /etc/postfix/mysql-virtual-mailbox-domains.cf << EOF
user = mailuser
password = $MAIL_DB_PASS
hosts = 127.0.0.1
dbname = mailserver
query = SELECT 1 FROM virtual_domains WHERE name='%s'
EOF

cat > /etc/postfix/mysql-virtual-mailbox-maps.cf << EOF
user = mailuser
password = $MAIL_DB_PASS
hosts = 127.0.0.1
dbname = mailserver
query = SELECT 1 FROM virtual_users WHERE email='%s' AND is_active=1
EOF

cat > /etc/postfix/mysql-virtual-alias-maps.cf << EOF
user = mailuser
password = $MAIL_DB_PASS
hosts = 127.0.0.1
dbname = mailserver
query = SELECT destination FROM virtual_aliases WHERE source='%s'
EOF

chmod 640 /etc/postfix/mysql-*.cf
chown root:postfix /etc/postfix/mysql-*.cf

# Configure master.cf for submission
cat >> /etc/postfix/master.cf << EOF

submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
smtps     inet  n       -       y       -       -       smtpd
  -o syslog_name=postfix/smtps
  -o smtpd_tls_wrappermode=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
  -o milter_macro_daemon_name=ORIGINATING
EOF

echo -e "${GREEN}✅ Postfix configured${NC}"

#################################################
# Step 5: Configure Dovecot
#################################################
echo -e "${CYAN}[5/12] Configuring Dovecot...${NC}"

# Create vmail user and directory
groupadd -g 5000 vmail 2>/dev/null || true
useradd -g vmail -u 5000 vmail -d /var/mail/vhosts -s /sbin/nologin 2>/dev/null || true
mkdir -p /var/mail/vhosts/$BASE_DOMAIN
chown -R vmail:vmail /var/mail/vhosts
chmod -R 770 /var/mail/vhosts

# Main Dovecot configuration
cat > /etc/dovecot/dovecot.conf << EOF
!include_try /usr/share/dovecot/protocols.d/*.protocol
protocols = imap pop3 lmtp
listen = *, ::
dict {
}
!include conf.d/*.conf
EOF

# Mail configuration
cat > /etc/dovecot/conf.d/10-mail.conf << EOF
mail_location = maildir:/var/mail/vhosts/%d/%n
namespace inbox {
  inbox = yes
}
mail_privileged_group = mail
mail_uid = vmail
mail_gid = vmail
first_valid_uid = 5000
last_valid_uid = 5000
EOF

# Authentication configuration
cat > /etc/dovecot/conf.d/10-auth.conf << EOF
disable_plaintext_auth = yes
auth_mechanisms = plain login
!include auth-sql.conf.ext
EOF

cat > /etc/dovecot/conf.d/auth-sql.conf.ext << EOF
passdb {
  driver = sql
  args = /etc/dovecot/dovecot-sql.conf.ext
}
userdb {
  driver = static
  args = uid=vmail gid=vmail home=/var/mail/vhosts/%d/%n
}
EOF

cat > /etc/dovecot/dovecot-sql.conf.ext << EOF
driver = mysql
connect = host=127.0.0.1 dbname=mailserver user=mailuser password=$MAIL_DB_PASS
default_pass_scheme = SHA512-CRYPT
password_query = SELECT email as user, password FROM virtual_users WHERE email='%u' AND is_active=1
EOF

chmod 640 /etc/dovecot/dovecot-sql.conf.ext
chown root:dovecot /etc/dovecot/dovecot-sql.conf.ext

# Master configuration
cat > /etc/dovecot/conf.d/10-master.conf << EOF
service imap-login {
  inet_listener imap {
    port = 143
  }
  inet_listener imaps {
    port = 993
    ssl = yes
  }
}
service pop3-login {
  inet_listener pop3 {
    port = 110
  }
  inet_listener pop3s {
    port = 995
    ssl = yes
  }
}
service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}
service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0666
    user = postfix
    group = postfix
  }
  unix_listener auth-userdb {
    mode = 0600
    user = vmail
  }
  user = dovecot
}
service auth-worker {
  user = vmail
}
EOF

# SSL configuration
cat > /etc/dovecot/conf.d/10-ssl.conf << EOF
ssl = required
ssl_cert = </etc/ssl/certs/ssl-cert-snakeoil.pem
ssl_key = </etc/ssl/private/ssl-cert-snakeoil.key
ssl_min_protocol = TLSv1.2
ssl_prefer_server_ciphers = yes
EOF

echo -e "${GREEN}✅ Dovecot configured${NC}"

#################################################
# Step 6: Configure SpamAssassin
#################################################
echo -e "${CYAN}[6/12] Configuring SpamAssassin...${NC}"

sed -i 's/ENABLED=0/ENABLED=1/' /etc/default/spamassassin
sed -i 's/CRON=0/CRON=1/' /etc/default/spamassassin

systemctl enable spamassassin
systemctl start spamassassin

echo -e "${GREEN}✅ SpamAssassin configured${NC}"

#################################################
# Step 7: Configure OpenDKIM
#################################################
echo -e "${CYAN}[7/12] Configuring OpenDKIM...${NC}"

mkdir -p /etc/opendkim/keys/$BASE_DOMAIN

cat > /etc/opendkim.conf << EOF
AutoRestart             Yes
AutoRestartRate         10/1h
UMask                   002
Syslog                  yes
SyslogSuccess           Yes
LogWhy                  Yes
Canonicalization        relaxed/simple
ExternalIgnoreList      refile:/etc/opendkim/TrustedHosts
InternalHosts           refile:/etc/opendkim/TrustedHosts
KeyTable                refile:/etc/opendkim/KeyTable
SigningTable            refile:/etc/opendkim/SigningTable
Mode                    sv
PidFile                 /var/run/opendkim/opendkim.pid
SignatureAlgorithm      rsa-sha256
UserID                  opendkim:opendkim
Socket                  inet:8891@localhost
EOF

cat > /etc/opendkim/TrustedHosts << EOF
127.0.0.1
localhost
$MAIL_DOMAIN
*.$BASE_DOMAIN
EOF

# Generate DKIM keys
cd /etc/opendkim/keys/$BASE_DOMAIN
opendkim-genkey -s mail -d $BASE_DOMAIN
chown opendkim:opendkim mail.private
chmod 600 mail.private

cat > /etc/opendkim/KeyTable << EOF
mail._domainkey.$BASE_DOMAIN $BASE_DOMAIN:mail:/etc/opendkim/keys/$BASE_DOMAIN/mail.private
EOF

cat > /etc/opendkim/SigningTable << EOF
*@$BASE_DOMAIN mail._domainkey.$BASE_DOMAIN
EOF

mkdir -p /var/run/opendkim
chown opendkim:opendkim /var/run/opendkim

systemctl enable opendkim
systemctl restart opendkim

echo -e "${GREEN}✅ OpenDKIM configured${NC}"

#################################################
# Step 8: Install Webmail Application
#################################################
echo -e "${CYAN}[8/12] Installing Webmail Application...${NC}"

# Create webmail directory
mkdir -p /var/www/webmail
cp -r /opt/email-hosting/webmail/* /var/www/webmail/
cp -r /opt/email-hosting/api /var/www/webmail/

# Install API dependencies
cd /var/www/webmail/api
npm install

# Create environment file
cat > /var/www/webmail/api/.env << EOF
NODE_ENV=production
PORT=3001
DB_HOST=127.0.0.1
DB_USER=mailuser
DB_PASS=$MAIL_DB_PASS
DB_NAME=mailserver
JWT_SECRET=$(openssl rand -hex 32)
MAIL_DOMAIN=$MAIL_DOMAIN
BASE_DOMAIN=$BASE_DOMAIN
IMAP_HOST=127.0.0.1
IMAP_PORT=143
SMTP_HOST=127.0.0.1
SMTP_PORT=587
EOF

# Create systemd service for API
cat > /etc/systemd/system/webmail-api.service << EOF
[Unit]
Description=Webmail API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/webmail/api
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

chown -R www-data:www-data /var/www/webmail
chmod -R 755 /var/www/webmail

systemctl daemon-reload
systemctl enable webmail-api
systemctl start webmail-api

echo -e "${GREEN}✅ Webmail installed${NC}"

#################################################
# Step 9: Configure Nginx
#################################################
echo -e "${CYAN}[9/12] Configuring Nginx...${NC}"

cat > /etc/nginx/sites-available/webmail << EOF
server {
    listen 80;
    server_name $MAIL_DOMAIN;
    root /var/www/webmail;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /admin {
        alias /var/www/webmail/admin;
        try_files \$uri \$uri/ /admin/index.html;
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
    }
}
EOF

ln -sf /etc/nginx/sites-available/webmail /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

echo -e "${GREEN}✅ Nginx configured${NC}"

#################################################
# Step 10: Setup SSL with Let's Encrypt
#################################################
echo -e "${CYAN}[10/12] Setting up SSL certificates...${NC}"

certbot --nginx -d $MAIL_DOMAIN --non-interactive --agree-tos -m $ADMIN_EMAIL || {
    echo -e "${YELLOW}⚠️ SSL setup failed. You can run 'certbot --nginx -d $MAIL_DOMAIN' later${NC}"
}

# Update Postfix and Dovecot to use Let's Encrypt certs if they exist
if [ -f "/etc/letsencrypt/live/$MAIL_DOMAIN/fullchain.pem" ]; then
    postconf -e "smtpd_tls_cert_file=/etc/letsencrypt/live/$MAIL_DOMAIN/fullchain.pem"
    postconf -e "smtpd_tls_key_file=/etc/letsencrypt/live/$MAIL_DOMAIN/privkey.pem"
    
    sed -i "s|ssl_cert = .*|ssl_cert = </etc/letsencrypt/live/$MAIL_DOMAIN/fullchain.pem|" /etc/dovecot/conf.d/10-ssl.conf
    sed -i "s|ssl_key = .*|ssl_key = </etc/letsencrypt/live/$MAIL_DOMAIN/privkey.pem|" /etc/dovecot/conf.d/10-ssl.conf
fi

echo -e "${GREEN}✅ SSL configured${NC}"

#################################################
# Step 11: Configure Firewall
#################################################
echo -e "${CYAN}[11/12] Configuring firewall...${NC}"

ufw allow 22/tcp    # SSH
ufw allow 25/tcp    # SMTP
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 587/tcp   # Submission
ufw allow 993/tcp   # IMAPS
ufw allow 995/tcp   # POP3S
ufw allow 143/tcp   # IMAP
ufw allow 110/tcp   # POP3
ufw --force enable

echo -e "${GREEN}✅ Firewall configured${NC}"

#################################################
# Step 12: Start all services
#################################################
echo -e "${CYAN}[12/12] Starting services...${NC}"

systemctl restart postfix
systemctl restart dovecot
systemctl restart nginx
systemctl restart spamassassin
systemctl restart opendkim

echo -e "${GREEN}✅ All services started${NC}"

#################################################
# Installation Complete
#################################################
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║     🎉 Installation Complete!                               ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}📧 Your Email Server is ready!${NC}"
echo ""
echo -e "${YELLOW}Access Points:${NC}"
echo "   Webmail:      https://$MAIL_DOMAIN"
echo "   Admin Panel:  https://$MAIL_DOMAIN/admin"
echo ""
echo -e "${YELLOW}Email Settings:${NC}"
echo "   IMAP Server:  $MAIL_DOMAIN (Port 993, SSL/TLS)"
echo "   SMTP Server:  $MAIL_DOMAIN (Port 587, STARTTLS)"
echo "   POP3 Server:  $MAIL_DOMAIN (Port 995, SSL/TLS)"
echo ""
echo -e "${YELLOW}Default Admin Login:${NC}"
echo "   Email:     $ADMIN_EMAIL"
echo "   Password:  admin123 (Change immediately!)"
echo ""
echo -e "${YELLOW}DNS Records Required:${NC}"
echo "   Add these DNS records to your domain:"
echo ""
echo "   A Record:     $MAIL_DOMAIN → $(curl -s ifconfig.me)"
echo "   MX Record:    $BASE_DOMAIN → $MAIL_DOMAIN (Priority: 10)"
echo "   TXT Record:   $BASE_DOMAIN → \"v=spf1 mx a ip4:$(curl -s ifconfig.me) ~all\""
echo ""
echo "   DKIM Record (mail._domainkey.$BASE_DOMAIN):"
cat /etc/opendkim/keys/$BASE_DOMAIN/mail.txt
echo ""
echo -e "${YELLOW}Log file:${NC} $LOG_FILE"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Change the default admin password immediately!${NC}"
echo ""
