# ADMIN-1G Admin Users Report

## Extended existing stack

`admin_users` + `admins.tsx` + `POST admins` / `POST admins/:id`

Additive: `display_name`, `GET admins/:id/detail` (effective permissions, sessions, secrets flags = false)

## Create

Allowed with `admins:manage` + privilege ceiling (`canGrantRole`).  
Default UI role OPS. SUPER create only by SUPER. Least privilege.

## Disable / Enable

YES — reason + audit; disable deletes all `admin_sessions`.  
Self disable blocked. Last ACTIVE SUPER disable blocked.

## Secrets

List/detail/me never return password, hash, salt, JWT, OTP.
