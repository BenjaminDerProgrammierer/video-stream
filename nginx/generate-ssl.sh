#!/bin/sh
# Generate self-signed SSL certificates with SAN for multiple domains/IPs

set -e

CERT_DIR="/etc/nginx/certs"
CERT_FILE="${CERT_DIR}/server.crt"
KEY_FILE="${CERT_DIR}/server.key"
DAYS=365

# Create certs directory if it doesn't exist
mkdir -p "${CERT_DIR}"

# Check if certificates already exist
if [ -f "${CERT_FILE}" ] && [ -f "${KEY_FILE}" ]; then
    echo "SSL certificates already exist. Skipping generation."
    exit 0
fi

echo "Generating self-signed SSL certificates..."

# Parse SSL_DOMAINS from environment variable (comma-separated)
DOMAINS="${SSL_DOMAINS:-localhost}"
echo "Domains/IPs for certificate: ${DOMAINS}"

# Build SAN list
SAN_LIST=""
DNS_COUNT=0
IP_COUNT=0

IFS=','
for domain in ${DOMAINS}; do
    # Trim whitespace
    domain=$(echo "${domain}" | xargs)
    
    # Check if it's an IP address (simple check)
    if echo "${domain}" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
        IP_COUNT=$((IP_COUNT + 1))
        if [ -z "${SAN_LIST}" ]; then
            SAN_LIST="IP:${domain}"
        else
            SAN_LIST="${SAN_LIST},IP:${domain}"
        fi
    else
        DNS_COUNT=$((DNS_COUNT + 1))
        if [ -z "${SAN_LIST}" ]; then
            SAN_LIST="DNS:${domain}"
        else
            SAN_LIST="${SAN_LIST},DNS:${domain}"
        fi
    fi
done

echo "Subject Alternative Names: ${SAN_LIST}"

# Get first domain for CN
FIRST_DOMAIN=$(echo "${DOMAINS}" | cut -d',' -f1 | xargs)

# Generate certificate with SAN
openssl req -x509 -nodes -days ${DAYS} \
    -newkey rsa:2048 \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}" \
    -subj "/C=US/ST=State/L=City/O=Video Stream/OU=IT/CN=${FIRST_DOMAIN}" \
    -addext "subjectAltName=${SAN_LIST}"

# Set proper permissions
chmod 644 "${CERT_FILE}"
chmod 600 "${KEY_FILE}"

echo "SSL certificates generated successfully!"
echo "Certificate: ${CERT_FILE}"
echo "Private Key: ${KEY_FILE}"
echo "Valid for ${DAYS} days"
