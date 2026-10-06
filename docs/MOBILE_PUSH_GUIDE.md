# Push notifications: what the app must do

The backend is live and tested end to end. The app only has to do 4 things.

```
App (FCM token) → customer-api → push service → Firebase → phone
```

Firebase project: `push-notification-servic-8c057`

## 1. After login: register the phone

Ask for notification permission, get the FCM token, then:

```
POST /api/v1/me/device-tokens
Authorization: Bearer <access token>
Content-Type: application/json

{ "token": "<FCM token>", "platform": "android" }   // or "ios"
```

Never send a user id. The server takes it from the login token.

| Answer | Meaning | What the app does |
|---|---|---|
| 204 | Saved | Nothing |
| 401 | Not logged in | Normal login flow |
| 403 | Account not verified | Register after OTP verification |
| 422 | Bad body (`code: validation_error`) | Bug in the app, log it |
| 503 | Push service down (`code: push_unavailable`) | Ignore, retry on next launch |
| 502 | Push service refused | Ignore, retry on next launch |

## 2. On every app launch and on token refresh

Call the same `POST` again. It is safe to repeat: it never creates duplicates,
and it keeps the device marked as active.

## 3. On logout: remove the phone

Call this **before** clearing the access token (it needs the login):

```
DELETE /api/v1/me/device-tokens
Authorization: Bearer <access token>
Content-Type: application/json

{ "token": "<FCM token>" }
```

## 4. Receiving and tapping a push

Every push has a title, a body and `data`. All `data` values are strings:

```json
{ "type": "booking.confirmed", "bookingId": "<booking uuid>" }
```

`type` is one of: `booking.confirmed`, `booking.cancelled`, `booking.rescheduled`.

On tap, open the booking screen for `data.bookingId`. Handle **both** cases:

- App in background, user taps: `messaging().onNotificationOpenedApp(...)`
- App closed, user taps: `messaging().getInitialNotification()` on startup

## Setup checklist

- [ ] Android 13+: request the `POST_NOTIFICATIONS` permission
- [ ] iOS: an APNs key must be uploaded in Firebase (Project settings, Cloud Messaging)
- [ ] Test on real phones, not simulators

## Quick test without the app

Register a token with `curl` (step 1), then ask the backend team to send a test
push to your user id. The result is visible in the push service's `notifications` table.