# WITHDRAWAL_FLOW

```
Player: amount + channel + account → POST /withdraw
  → validate min/max/daily/channel
  → MoneyService.debit(amount) hold
  → status UNDER_REVIEW (V1 always review)
Admin: approve → APPROVED → pay → PAID
     or reject → REJECTED + release credit
Player cancel (PENDING/UNDER_REVIEW) → CANCELLED + release
```

**Statuses:** PENDING → UNDER_REVIEW → APPROVED → PAYING → PAID | REJECTED | CANCELLED | FAILED  

**Anti-overdraw:** debit before insert. **Anti-double:** unique idempotency + ledger keys.  
**PII:** account masked in responses; cipher stored opaque (not production encryption — TEST).  
**Fees:** from admin config (`feeMinor` / `feeBps`) — BR-006 PENDING placeholders.
