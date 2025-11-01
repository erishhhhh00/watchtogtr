#!/usr/bin/env bash
set -euo pipefail

# VPS bootstrap script for Ubuntu to run the app with Docker in production
# Usage: sudo ./scripts/vps-setup.sh <PUBLIC_ORIGIN>
# Example without domain: sudo ./scripts/vps-setup.sh http://YOUR_VPS_IP
# Example with domain + SSL terminated elsewhere: sudo ./scripts/vps-setup.sh https://yourdomain.com

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
	echo "Please run as root (use sudo)." >&2
	exit 1
fi

PUBLIC_ORIGIN=${1:-}
if [[ -z "$PUBLIC_ORIGIN" ]]; then
	echo "PUBLIC_ORIGIN is required, e.g. http://<IP> or https://<domain>" >&2
	exit 1
fi

echo "==> Installing Docker Engine and Compose plugin"
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
	"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \\n+  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
	tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

echo "==> Generating JWT secret"
JWT_SECRET=$(tr -dc A-Za-z0-9 </dev/urandom | head -c 48)

echo "==> Writing .env.prod file"
cat > .env.prod <<EOF
PUBLIC_ORIGIN=${PUBLIC_ORIGIN}
JWT_SECRET=${JWT_SECRET}
EOF

echo "==> Building containers (this may take a few minutes)"
docker compose -f docker-compose.prod.yml --env-file .env.prod build

echo "==> Starting services"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo "==> Done. Visit: ${PUBLIC_ORIGIN}"
echo "If you used an IP (http), ensure port 80 is open in your firewall / cloud security group."
