# Carrington Brown — Analytics Dashboard

## Access Link
**Local:** http://localhost:3000/dashboard?key=buckets2026
**Live (Render):** https://carringtonbrown.com/dashboard?key=buckets2026

## Password
`buckets2026`

## What It Tracks
- Page views (daily, 7-day, 30-day, all-time)
- Unique visitors
- Section engagement (which sections get viewed)
- Button clicks (Book Now, View Press Kit, Submit to Buckets, etc.)
- Form submissions (booking inquiries vs beat submissions)
- Social/link clicks (Instagram, YouTube, TikTok, IMDb, emails)
- Endorsement clicks (Yamaha, Sabian, ProMark, Evans, Roland)
- Device breakdown (mobile / desktop / tablet)
- Referrer sources (where traffic comes from)
- Hourly traffic patterns
- 14-day visual trend chart

## Notes
- Data auto-saves every 30 seconds to `analytics-data.json`
- Dashboard is private — only accessible with the key
- To change the password, update `DASH_KEY` in server.js or set the `DASH_KEY` environment variable on Render
