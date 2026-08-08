# I18N_PARITY_SCAN

Tool: `docs/m8-review/xi-game-v2/step-5-finalize/_i18n-check.mjs`  
Source: `client/xi-lobby/i18n.ts`

```json
{
  "counts": { "zh": 162, "en": 161, "my": 161 },
  "missingEn": ["zh-CN"],
  "missingMy": ["zh-CN"],
  "missingZhFromEn": []
}
```

## Interpretation

- `missingEn/My: ["zh-CN"]` is the locale block label false-positive from the key scraper (not a missing UI string).
- Additive rankings range keys present in **zh / en / my-MM**:
  - `lobby.bdk.rankings.range.today`
  - `lobby.bdk.rankings.range.7d`
  - `lobby.bdk.rankings.range.30d`
- Commerce readiness keys remain: `notProductionReady`, `tempHarness`, `placeholderLimits`

## Verdict

Lobby/hub i18n parity for RC keys: **PASS** (no real missing cross-locale keys for rankings addons).
