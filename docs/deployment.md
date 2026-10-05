# APSRTC SmartTrack - Deployment & Operations Guide

## 1. Environments
The system is built to transition seamlessly from local development to cloud production.

| Component | Local Dev | Cloud Production |
|---|---|---|
| Backend Server | Node.js (Port 5000) | Node.js Cluster / PM2 / Docker (Port 5000 behind NGINX) |
| WebSockets | Socket.IO Polling/WS | Socket.IO with Redis Adapter for multi-instance clustering |
| Database | SQLite (WAL mode) | PostgreSQL 15+ (Cloud SQL / Amazon RDS) |
| TLS/SSL | HTTP / Localhost | HTTPS via Let's Encrypt / Cloudflare SSL termination |

---

## 2. Docker Deployment
A complete Dockerfile and `docker-compose.yml` are provided in the project root.

### Running with Docker:
```bash
docker compose up -d --build
```

---

## 3. Production NGINX Reverse Proxy Configuration
```nginx
server {
    listen 80;
    server_name smarttrack.apsrtc.ap.gov.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name smarttrack.apsrtc.ap.gov.in;

    ssl_certificate /etc/letsencrypt/live/smarttrack.apsrtc.ap.gov.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/smarttrack.apsrtc.ap.gov.in/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Production Environment Variables (.env)
```ini
PORT=5000
NODE_ENV=production
DB_CLIENT=postgres
PG_HOST=postgres-cluster.apsrtc.internal
PG_PORT=5432
PG_USER=apsrtc_smarttrack_user
PG_PASSWORD=PROD_STRONG_PASSWORD_HERE
PG_DATABASE=apsrtc_smarttrack
CORS_ORIGIN=https://smarttrack.apsrtc.ap.gov.in
DEMO_MODE=false
FRESHNESS_LIVE_SEC=10
FRESHNESS_RECENT_SEC=60
FRESHNESS_STALE_SEC=300
```
