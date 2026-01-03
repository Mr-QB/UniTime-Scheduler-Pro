# Cloudflare Tunnel Setup

## Step 1: Verify .env file
Kiểm tra file `.env` có token Cloudflare chưa:
```
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiNjMwNzViNDliYTk4ZTljZGQ4MGQwMjEzNjQ1ODhiNTMiLCJ0IjoiZGI0MmE2ZGMtOTA4YS00NzU5LTk0NjEtN2MxNTIxZDY1NzM1IiwicyI6IlpqSXpNalJsTVdZdE1qTmpOUzAwTVRVeExXSTFOamd0WmpFeFlqZG1NRE0wTldWaSJ9
```

## Step 2: Stop existing containers
```powershell
docker stop unitime-scheduler-pro
docker rm unitime-scheduler-pro
```

## Step 3: Start with docker-compose
```powershell
docker-compose up -d
```

## Step 4: Configure Public Hostname in Cloudflare
1. Vào https://dash.teams.cloudflare.com
2. Navigate to Networks → Tunnels → atam
3. Chọn "Public Hostname" tab
4. Click "Add public hostname"
5. Điền:
   - **Subdomain**: (ví dụ: `scheduler`)
   - **Domain**: chọn domain của bạn
   - **Type**: HTTP
   - **URL**: `http://app:3000`
6. Lưu

## Step 5: Verify
- Chạy: `docker-compose logs -f cloudflare-tunnel`
- Sẽ thấy: `Tunnel running at ...`
- Truy cập domain của bạn qua HTTPS (Cloudflare tự cấp SSL)

## Lệnh hữu ích
```powershell
# Xem logs
docker-compose logs -f

# Xem logs tunnel
docker-compose logs -f cloudflare-tunnel

# Stop all
docker-compose down

# Restart
docker-compose restart
```

## Troubleshooting
Nếu tunnel không connect:
- Kiểm tra `.env` file có token đúng không
- Chạy: `docker-compose logs cloudflare-tunnel`
- Token hết hạn? → Regenerate token ở Cloudflare dashboard
