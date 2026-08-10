# PLAYER_AUTH_1A_SECURITY_TEST

**Date:** 2026-08-10

| Test | Result |
|---|---|
| Stub fail-closed without Bridge / test mode | PASS（unit） |
| Test OTP only under `AB_AUTH_OTP_TEST_MODE=1` | PASS |
| Phone normalize + unique | PASS |
| Register/login/forgot password path（test mode） | PASS |
| OTP not stored plaintext | PASS（code review） |
| SK password not in XI GAME / Git / reports | PASS |
| Direct SK fetch from XI GAME | FORBIDDEN（removed stub live path） |
| Real SMS smoke with approved ENV | **BLOCKED** — credentials MISSING |
| Guess password / enable stub for验收 | **NOT DONE**（正确） |
