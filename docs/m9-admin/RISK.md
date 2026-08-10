# R1-M9 Admin — Risk Notes

## Safety posture

- Admin surface is **read-only by default**.
- Allowed game mutation: `players.status` freeze/unfreeze only (reason + audit).
- Forbidden: Wallet / Ledger / Math / Spin / Round / Session / RTP / RNG / Paytable / DB history writes.

## Residual risks

| Risk | Mitigation |
|---|---|
| Announcement schedule is metadata-only | `publishAt` stored in content JSON; publish still requires explicit admin action (no auto-cron) |
| Multi-device signals | Honest `MULTI_DEVICE_UNAVAILABLE`; do not invent fingerprints |
| Room dimension | No room table; currency used as proxy — labeled in UI |
| System API probe | `api.ok` means in-process handler answered, not an external health hop |
| HF spin threshold | Fixed ≥30 rounds / 5 minutes; may need product tuning later |
| Deep-link tabs | Client-only tab props; refresh loses deep-link context |

## Do not

- Run ALTER / drizzle migrations for announcements
- Add balance / settlement / math freeze write APIs
- Commit / merge / push / PR unless explicitly ordered
