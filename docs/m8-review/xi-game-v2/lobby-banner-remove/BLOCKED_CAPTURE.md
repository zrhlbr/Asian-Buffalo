# BLOCKED_CAPTURE — Lobby Banner Remove

## Status: BLOCKED

Headed device / browser screenshots were **not** captured in this agent run.

### Requested but unavailable here

- Mobile 320 / 375 / 430 home scroll (banner gone, no gap)
- zh / en / my top-bar lang (no clip)
- Activity Center → check-in panel
- Recommended HOT vs Coming Soon contrast
- Hub / Play smoke (no regress)

### Why blocked

- No headed browser / phone attach in this subagent session
- No Playwright visual project wired for `/xi` lobby in this closure package

### Unblock conditions

1. Open `/xi` on 320–430 viewport (Chrome device mode or real phone)
2. Confirm home ends at Quick → bottom nav (no 每日登录奖励 banner)
3. Open 活动 → 签到 → `CheckinPanel` loads
4. Switch 中文 / မြန်မာ / EN without top crush
5. Tap 牛魔王 HOT → Hub still works; Coming Soon → modal only
6. Drop PNG/WebP into this folder and flip REGRESSION rows 15–16 to PASS
