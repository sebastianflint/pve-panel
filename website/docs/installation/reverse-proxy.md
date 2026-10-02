---
title: HTTPS and reverse proxy
sidebar_position: 7
---

Terminate TLS in front of the customer panel, and publish only that port. The
console needs websocket upgrades:

```nginx
server {
    listen 443 ssl http2;
    server_name panel.example.com;
    # ssl_certificate ...;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 1h;
    }
}
```
