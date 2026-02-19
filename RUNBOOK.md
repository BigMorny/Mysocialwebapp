# NMysocial Operations Runbook

## Rollback Procedure

### App rollback
1. Roll back app to previous release tag/build.
2. Restart app services.
3. Re-run health and login checks.

### DB rollback (if migration issue)

```bash
pg_restore -d "<PROD_DATABASE_URL>" --clean --if-exists backup_YYYYMMDD_HHMM.dump
```

Then:
- restart API
- verify `/api/health`
- verify login/admin flows

---

## Admin SOP

### Before deleting a shop
1. Export shop data first (inventory/dealers/consignments).
2. Confirm delete dialog by typing shop name or `DELETE`.
3. Verify audit log includes `DELETE_SHOP`.

### Weekly admin review
- pending payment approvals
- expired/view-only shops
- audit actions:
  - `DELETE_SHOP`
  - `SHOP_SUSPENDED`
  - `SHOP_ACTIVATED`
  - `SHOP_TRIAL_EXTENDED`

---

## Trial normalization utility (one-time)

Endpoint:
- `POST /api/admin/utils/normalize-trials-to-7-days`

Body:

```json
{
  "confirm": "NORMALIZE_TRIALS_TO_7_DAYS"
}
```

Example:

```bash
curl -X POST https://api.yourdomain.com/api/admin/utils/normalize-trials-to-7-days \
  -H "Content-Type: application/json" \
  -b "mysocial_session=<admin_cookie>" \
  -d '{"confirm":"NORMALIZE_TRIALS_TO_7_DAYS"}'
```

Response includes:
- `processed` shops
- `updated` shops capped
- `cappedTo` timestamp

---

## Secrets policy

### Do not commit
- `apps/api/.env`

### Rotate immediately if exposed
- SMTP credentials
- database URL credentials
- admin password
- session/cookie secrets

### Rotation cadence
- monthly: admin password + cookie/session secrets
- immediate: any leaked credential

---

## Minimum monitoring checks

1. API health:
```bash
curl -i https://api.yourdomain.com/api/health
```

2. Error logs:
- watch auth failures spikes
- watch admin verification failures spikes

3. Subscription health:
- track number of `EXPIRED` shops
- track pending approval backlog

