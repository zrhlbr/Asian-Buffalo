# Wallet Center — I18N_REPORT

## Locales

| Locale | Keys |
|--------|------|
| zh-CN | `lobby.wc.*` complete |
| en | parity |
| my-MM | parity |

## Gate

```text
assertLobbyI18nComplete() → { ok: true, missing: [] }
```

## New key family (`lobby.wc.*`)

- title / harnessBadge / totalAssets / noData  
- trend / trendReserved / usdtRail / ledger / records  
- tab.deposit|withdraw|game|activity|redpacket  
- filter.from|to|search|searchPh  
- page.prev|next  
- empty.deposit|withdraw|game|activity|redpacket  
- game.bet|win  
- deposit.rails  
- withdraw.statusShell|reviewShell|history  
- ledger.all|income|expense|reward|refund|game  

## Hardcoded UI strings

- Currency codes `MMK` / `USDT` / `ZRHPay` as rail labels (product codes, not copy).  
- Em dash `—` for frozen unavailable.  
- All user-facing sentences via `t(...)`.
