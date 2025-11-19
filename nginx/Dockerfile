FROM nginx:alpine

# Install openssl for SSL certificate generation and curl for health checks
RUN apk add --no-cache openssl curl

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy SSL generation script
COPY generate-ssl.sh /docker-entrypoint.d/20-generate-ssl.sh
RUN chmod +x /docker-entrypoint.d/20-generate-ssl.sh
