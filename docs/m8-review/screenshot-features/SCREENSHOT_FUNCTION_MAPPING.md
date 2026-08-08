# SCREENSHOT_FUNCTION_MAPPING.md

**Reference policy:** African Buffalo screenshots (if any) used ONLY for IA/UX completeness. No logo/buffalo art/people/proprietary assets copied.  
**Search result:** No African Buffalo product screenshots found in workspace for Profile/VIP/Wallet. Design from commercial brief + this mapping + BUSINESS_RULES_PENDING.

| Ref IA surface | Asian Buffalo feature | Phase | Modal / Module | Money risk |
|----------------|----------------------|-------|----------------|------------|
| Player center / me | Profile + Avatar | 2 | In-game `#profile-modal` | Low (no balance write) |
| VIP badge / levels | VIP 1–6 status + level pages | 3 | `#vip-modal` | Config only |
| Reward chests | Daily/weekly/monthly/level/event | 4 | VIP modal chests | High — Ledger credit |
| Deposit | Deposit order + presets | 5 | `#wallet-modal` deposit tab | High — paused rules |
| Withdrawal | Withdrawal states + admin review | 6 | Wallet withdraw tab | High — paused rules |
| Payment channels | KBZ/Wave/TRC20 config | 7 | Admin + wallet channel list | High — paused rules |
| Help / CS | Help center + tickets | 8 | `#help-modal` | Low |
| Rules / News | Rules + Information Center | 9 | Help + announcements extend | Low |
| Admin ops | Players/VIP/deposit/withdraw/tickets/channels | 10 | M9 admin modules | RBAC+Audit |
| E2E | Automated + headed capture | 11 | tests + report | Gate |

## Overlay rules
- Style: black-gold / purple-gold Asian Buffalo (original CSS vars).
- During spin (`game.busy`): block Profile / VIP / Wallet open; Help may wait until spin ends.
- Never interrupt Spin / Round / Settlement.
- Close = hide DOM only — never dispose renderer/scene.
