-- Daily cleanup for the push service. Run by cron on the server (see README).
--
-- devices: drop phones Google told us are dead (status = 'invalid'), and phones
-- that have not checked in for 60 days. The app re-registers on every launch,
-- so a phone that is still in use always has a fresh last_seen_at.
--
-- notifications: keep 90 days of history for support questions, then let go.

DELETE FROM devices
 WHERE status = 'invalid'
    OR last_seen_at < now() - interval '60 days';

DELETE FROM notifications
 WHERE created_at < now() - interval '90 days';