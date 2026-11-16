# TripLink test plan

Derived from reading the code, not the README (the README describes an older "RailMeet" app and is stale).
Stack: Next.js 16 App Router, zustand store, Supabase via server-only `/api/db`, OTP session cookie.

## 0. Progress

Run `npm test` (Vitest, 331 tests, 11 files; stable over repeated runs).
- L1 pure libs: `tests/lib` (ports all 5 `*.check.mjs`, which can now be deleted).
- L2 server: `tests/server` (session, OTP + auth routes, connections/chat/block/delete, trips/matching/boarding-pass verification, `/api/db` gatekeeping, flight/PNR/scan routes).
- L3 client: `tests/client` (store actions incl. optimistic rollback, polling merge, flight refresh throttle; every onboarding screen; Add trip sheet for train/flight/manual/scan; Trips, Matches, Chats, Profile, sheets, nav, toast; app shell 401 sign-out).
- Tests named "known gap" or "characterization" pin current behaviour from section 6; change them when you decide the intended behaviour.
- Bug found and fixed by the suite: `/api/db` resolved prototype keys (`toString`) as actions.
Not started: L4 Playwright journeys (section 4); real-browser concerns (camera/file picker, PDF417 decoding in `boardingPassScan`, layout).

## 1. Current state

- No test runner. Only 5 hand-run `*.check.mjs` asserts (`bcbp`, `chatMerge`, `travelDate`, `tripVisibility`, `aerodatabox`). Run by `node file.mjs`; the aerodatabox one imports `jiti`, which is not in `package.json` (only transitive).
- Untested: every API route, `db.ts` (756 lines, all matching/request/inbox logic), the store (672 lines), all UI, PNR scrapers, session signing, OTP store.

## 2. Tooling (proposal)

| Layer | Tool | Scope |
|---|---|---|
| L1 unit | Vitest (node) | pure libs; absorb existing `*.check.mjs` |
| L2 server | Vitest + in-memory fake of `supabaseAdmin()` | `db.ts`, `otpStore`, route handlers, scrapers (mock `fetch`) |
| L3 client | Vitest + jsdom + Testing Library, `fetch` mocked | store actions, screens, sheets |
| L4 e2e | Playwright (mobile viewport) vs `next dev` | full journeys, 2 browser contexts for two-user flows |

New devDeps: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@playwright/test`. Add `vite-tsconfig-paths` for the `@/` alias.

The one design decision: **fake Supabase**. `db.ts` uses the query builder (`from/select/eq/neq/in/or/gte/order/limit/maybeSingle/upsert/insert/update/delete`). Write a ~150-line in-memory fake supporting exactly these calls (including the `.or('and(...)')` strings used for matches/blocks) and a `failNext(table, error)` hook. L2 and L4 both use it (L4 via `TEST_FAKE_DB=1` branch in `supabaseAdmin.ts`, or a real Supabase test project instead).

Env for tests: `SESSION_SECRET` (32+ chars), no `FAST2SMS_API_KEY`, no `AERODATABOX_API_KEY` unless a case sets it. Control the clock with `vi.setSystemTime` (travel dates, OTP expiry, `showFrom`).

## 3. Workflows and cases

Priority: P0 = money/privacy/auth, P1 = core journey, P2 = polish.

### W1. Phone login (OTP) — P0
Code: `PhoneScreen`, `OtpScreen`, `api/auth/send-otp`, `api/auth/verify-otp`, `otpStore`.
- send-otp: <10 digits → 400; `+91 98765-43210` normalised to last 10; demo phone / no SMS key → success + `devOtp` only when `NODE_ENV!=production`; Fast2SMS ok / `return:false` → 502; fetch throws → 500.
- verify-otp: missing phone/otp → 400; `1234` accepted in dev and in prod-without-SMS-key; in prod with key only `DEMO_PHONES` accept `1234`; correct OTP deletes row (single use); wrong OTP increments attempts; 5 attempts → row deleted + "Too many"; expired → deleted + "expired"; no row → "expired or not requested".
- Supabase down → in-memory fallback path used; fallback has **no attempt counter** (pin as known gap).
- Success sets `tl_session` cookie, returns `userId=usr_<phone>`, `profile` null for new user / row for existing.
- UI (L3): OtpScreen typing, backspace to previous box, paste `12 34`, SMS autofill spreading `1234` into boxes, double-digit overwrite, Enter submits, <4 digits toast, resend toast, loading disable. PhoneScreen strips non-digits, Enter submits.
- Routing after verify: profile row → `main` with profile+modes loaded (`mode_business` null → true); no profile → `mode`.
- E2E: new number happy path with `1234`.

### W2. Onboarding: mode + profile — P1
Code: `ModeSelectionScreen`, `ProfileSetupScreen`, `saveProfileAndEnter`, `syncUserProfile`.
- Continue disabled when both modes off; Back hidden for new users, shown with existing profile.
- Business-only shows business fields; social-only shows social; both shows both.
- Chip toggles add/remove in `look/cities/interests/langs`.
- Save → `syncProfile` called with profile + modes, screen `main`, toast. Currently **no required-field validation** (empty name saves); pin as characterization test and decide intended behaviour.
- `syncUserProfile`: name falls back `name → first → 'Traveler'`; `intent = look[0] ?? 'Partner'`; v2 columns only when schema probe passes; DB error → false.

### W3. Session lifecycle — P0
Code: `lib/server/session.ts`, `api/auth/{session,logout}`, `page.tsx`, `supabaseSync.call`.
- encode/decode round-trip; tampered userId/exp/sig rejected; expired rejected; malformed id (not `usr_\d{10}`) rejected; missing `SESSION_SECRET` / short secret throws.
- `/api/auth/session` 200 vs 401; logout clears cookie.
- Any `/api/db` 401 fires the unauthorized handler once → store `logout()` + "Session expired" toast; handler only registered while `screen==='main'`.

### W4. Add train trip by PNR — P0
Code: `AddTripSheet` (train), `api/pnr/verify`, `pnrScraper/*`, `pnr.ts`, `mockData`.
- `validatePNR`/`maskPNR`: 10 digits, first digit 1–9, spaces/dashes stripped; mask `28******51`.
- Waterfall order: invalid → preset (3 demo PNRs, date = today IST) → cache → ConfirmTkt → EaseMyTrip → "PNR not found" with last reason.
- Cache: only CONFIRMED + chart prepared stored; 15 min TTL; `forceFresh` bypasses.
- ConfirmTkt mapping (mock fetch): `Error` / `InformationMessage` / missing TrainNo → reason; HTTP !ok; 8s abort → timeout reason; berth code mapping table (`WS, SL, SU, LB, MB, UB`); status `CNF/RAC/WL`; unparseable `Doj` → failure. EaseMyTrip: null on any failure; hard-coded `status:'CONFIRMED'` (pin).
- Route: raw `pnr` never in response (`pnr: undefined`); 400 without pnr; 404 on failure; 500 on throw.
- **Note:** this route has no auth/rate-limit; add a test documenting that decision.
- UI: non-10-digit error; demo chip fills PNR; found card shows coach/berth; Continue → step 2; network failure message; changing PNR clears found/err.

### W5. Add flight trip — P0
Code: `AddTripSheet` (flight), `api/flights/verify`, `flightScraper`, `flightLookup`.
- `parseFlightNumber`: `6E 214`, `ai-887`, `QP1354`; reject `X`, `123456`.
- `cacheTtlMs` table (already in check file → port).
- `verifyFlightWaterfall` (mock fetch + fake cache): no key → not found; 200 mapped (times, duration, `T2`); 204/404 → cached "not found"; 500/timeout → **not** cached; cache hit within TTL skips fetch; expired → refetch; multi-leg takes first with both IATA codes; no date → today IST.
- `lookupFlight` shape mapping, `departsAt` +05:30; `isCancelled/isDelayed`.
- UI: empty flight number error; 404 → manual form shown + message; manual validation (flight regex, 3-letter codes, from≠to); manual result "Added manually…" label; Train/Flight toggle resets found/err; date change resets found.
- E2E: flight lookup (mock `/api/flights/verify`) → visibility → confirm.

### W6. Boarding-pass scan & ticket verification — P0
Code: `bcbp.ts`, `boardingPassScan.ts`, `api/pass/scan`, `PassPicker`, `TripsTab.handleVerify`, `verifyTripTicket`, `boardingPassVerifies`.
- `parseBcbp`: port existing cases; plus 3- and 4-leg, conditional-size hex, operating suffix (`214A`), leading-zero flight number, lowercase/garbage, truncated mid-leg, `legCount` 0/5.
- `julianToIso`: year boundary, leap day 366, port existing.
- `boardingPassVerifies`: matches carrier+flight and date; wrong date; wrong flight; second leg match.
- `verifyTripTicket`: false when column missing, date unknown, pass mismatches; true re-syncs row with `ticket_verified:true`; later re-sync without a pass never un-verifies. **Raw barcode not persisted** (assert no write contains name/PNR).
- `/api/pass/scan`: 401 without session; non-image/missing file/>15 MB → 400; undecodable → 422; fixture PDF417 image → raw text; image with non-BCBP barcode → `raw:null`. Needs 1–2 fixture images in `tests/fixtures`.
- `readBoardingPassBarcode`: browser decode wins; browser throws → server fallback; server non-ok → throws.
- UI: PassPicker sheet (camera/photos inputs, re-pick same file); `handleVerify` toasts (no barcode, wrong flight, success, fail); verify button hidden for trains, verified, past, cancelled trips.
- Known stale comment: store `verifyTrip` says pass name is checked against the profile; code no longer does. Test the real behaviour (no name check) and fix the comment.

### W7. Trips list and visibility — P1
Code: `TripsTab`, `confirmAddTrip`, `tripVisibility.ts`, `syncUserTrip`, `fetchUserTrips`, `journey.ts`.
- `extractJourneyKey`: `NAME (20901)`, `6E 214`, `Flight AI 887`, 5-digit fallback, junk.
- `tripTravelDate` legacy `when` fallback; `isPastTrip`; `tripKey` dedupe.
- `showFromFor`: off → null; with `departsAt` → −2h; without → midnight IST. `canSee` matrix: both modes, one-sided, `visible_*` null legacy, future/past `show_from`.
- `syncUserTrip`: id format; route split on `→`/`->`; `mode` label; no date → false; v2 columns conditional; upsert error → false.
- `fetchUserTrips`: filters past dates, ordered, `kind` from numeric `train_number`, legacy row `visible_*` derived from `mode`.
- Store `confirmAddTrip`: new trip first + selected + tab `trips`; profile synced **before** trip; toast "View Matches" action navigates; no-op without `found`.
- UI: upcoming vs past split; visLabel (`Hidden` when both off); badges (2 h, verified, cancelled, delayed); empty state.

### W8. Co-traveller matching — P0
Code: `fetchLiveCoTravelers`, `MatchesTab`, `refreshLiveMatches`, `withTripMatches`.
- Same train+date match, excludes self; different date excluded.
- Corridor fallback only when exact match is empty, needs v2 + both station codes, limit 20, `line` text says corridor.
- Dedupe one entry per user; blocked either direction excluded; `canSee` honoured (viewer social-only vs other business-only → hidden; `show_from` in future → hidden).
- `type` Business vs Social rule; `fitScore` = 80 +12 same industry +6 same coach / +3 adjacent, capped 98; initials; missing profile → "Co-Passenger"; `ticketVerified` flag.
- Errors: `tripErr` → throws → route 500 → client keeps cached list (`fetchLiveCoTravelers` returns null → no state change).
- Store: `withTripMatches` replaces only that trip's rows and drops contact-only duplicates.
- UI: filters All/Business/Social/Same industry; empty state text; cancelled flight shows paused note and stops fetch; trip dropdown switches and resets filter; "Live Co-Travelers" count.

### W9. Connect: request / accept / decline — P0
Code: `sendConnectionRequest`, `respondToConnectionRequest`, `fetchInbox`, store actions, `MatchesTab`, `MatchDetailSheet`.
- New request → row `pending`, id = `match_<sorted ids>_<journey>_<date>` identical from both sides.
- State machine (table-driven): none→sent; I resend pending→`sent` (no dup); they requested pending→mutual accept→`accepted`; accepted→`accepted`; declined by them→`declined` (blocked from resending); declined by me→reopens as my request; unique-violation `23505` retries once; read error → null.
- `respondToConnectionRequest`: only receiver of a **pending** row; non-receiver / already answered → false.
- `/api/db sendRequest`: self-request → 400; invalid id → 400; fit clamped to 0–100 else 85. **Gap to decide:** server does not check the receiver actually has a matching trip or that the requester is on the trip; pin current behaviour.
- `fetchInbox`: incoming list excludes blocked and already-accepted requesters; outgoing statuses; accepted on any trip wins; contacts built from profiles; chats keyed `match_<uid>`; DB error throws.
- Store: optimistic `sent` then rollback to `prev` on failure; toasts for each outcome; accept removes incoming, adds contact + empty chat; decline removes incoming; `syncUserRequests` ignores result if user changed meanwhile.
- UI: button states Connect / Request sent / Message; incoming cards grouped "this trip" vs "other trips".
- E2E (two contexts): A and B add same flight → A connects → B accepts → both see Message.

### W10. Chat — P0
Code: `ActiveChatView`, `ChatsTab`, `sendChatMessageToSupabase`, `fetchLiveChatMessages`, `chatMerge`, `usePoll`.
- `mergeChat` / `countNewIncoming` (port existing).
- `resolveConnectionRowIds`: pair with several accepted rows writes to the first by sorted id, reads merge all.
- send: no accepted connection → false; `/api/db sendMessage` validation (`msg_` id format, 2000 char cap, bad chat key).
- Store `sendMessage`: trims, ignores blank / no active chat; pending → cleared on ok, `failed` + toast on error; `shareBusinessCard` sends `is_card`; polled merge keeps pending/failed local messages; unread flagged only when new incoming and chat not open; `openChat` clears unread; blocked chat ignored (`gone`).
- UI: composer disables empty send; quick chips send; card renders sender details (mine shows phone); "Sending…"/"Not sent"; list shows last message preview, unread badge; menu → Share / Block / Report.
- `usePoll`: ticks while visible, stops when hidden, runs immediately on show, null key off, restart on key change (fake timers + `document.hidden`).

### W11. Block and report — P0
Code: `blockUserInSupabase`, `reportUserInSupabase`, store, `SafetySheet`, menus.
- Block: upsert id `blk_<a>_<b>`; all matches between pair set `declined`; mutual invisibility in co-travellers + inbox; bad ids → false.
- Report: inserts reason+details; **also blocks** (store); toast text; reason list; details > 1000 chars → 400.
- Store `blockPerson`: marks `gone`, clears req/chat/unread, closes chat/sheet.
- Blocked user can no longer send messages (their connection row is `declined`).
- Known quirk to pin: store block/report are fire-and-forget; local state removes the person even if the server call fails.

### W12. Profile tab — P2
- Header initials/subtitle fallbacks; Edit profile → `create`; mode toggles sync immediately only on `main`; Pro toggle + toast; "Download my data" is a stub toast (flag as unimplemented); Safety centre sheet; Log out.
- Turning both modes off is allowed here (unlike onboarding) → trips show visibility `Hidden`; confirm intended.

### W13. Logout, account deletion, multi-account isolation — P0
- `logout`: clears user data, new anon id, cookie cleared, welcome screen.
- `loginUser` with a different id wipes trips/chats/matches of previous account; same id keeps them; remote trips merged without duplicates.
- `deleteUserAccount`: order children→parents, stops at first failure (returns false, session stays), deletes OTP row, keeps reports, clears cookie on success. `resetAll` shows error toast and stays signed in on failure.
- Delete sheet confirm/cancel.
- Persist: `partialize` excludes `unread`, `incomingRequests`, `toastMessage`; assert nothing sensitive extra (OTP digits) is persisted.

### W14. Background refresh — P1
- Inbox polled every 20s on `main`; matches every 15s unless past/cancelled trip; chat every 5s; all pause when tab hidden.
- `refreshFlightTrip`: only flights within 0–7 days, throttled 10 min per trip, ignores lookups whose airports disagree with trip, updates + re-syncs only when `departsAt` changed, no write when nothing changed.

### W15. `/api/db` hardening — P0
- 415 without JSON content-type; 401 without session; 400 invalid JSON, unknown action, each validator (`str` length, `bool`, `strArr` size, `userId` regex, `rowId`, `msgId`, `code`, `trip` date/`departsAt`); `BadInput` → 400, other errors → 500 with generic body.
- Caller id always from cookie: sending another `userId` in args never changes whose data is touched (table-driven over every action).

### W16. Schema compatibility — P2
- `hasV2Schema` / `hasTicketColumn`: probe once; missing-column errors cached as false; network error not cached (retried).
- Run W7/W8 suites against both schema variants (legacy columns only vs full).

### W17. App shell and layout — P2
- Screen routing for each `screen`/`tab`; BottomNav switching closes chat/sheets (`setTab`); Toast auto-dismiss 2.8 s / 4.5 s with action, newer toast not cleared by older timer.
- Mobile-viewport smoke screenshots (Playwright) for each screen.

## 4. End-to-end journeys (Playwright, fake or test DB)

1. New user: phone → `1234` → modes → profile → empty Trips.
2. Add demo-PNR train → visibility → confirm → trip listed.
3. Two users on same flight: match visible, connect, accept, exchange messages, unread badge, card share.
4. Block from chat; other user no longer matches or can message.
5. Boarding-pass verify (fixture image): badge appears for self, "Ticket" pill for the other user.
6. Logout → login as different number → previous data absent; delete account → login shows new-user flow.
7. Session expiry mid-use (clear cookie) → toast + welcome screen.

## 5. Suggested order

1. Set up Vitest, port the 5 check files (L1), CI script `npm test`.
2. Fake Supabase + W15, W3, W1 (auth and boundary first: highest risk).
3. W9, W8, W10, W11, W13 on `db.ts` (core logic, no UI).
4. W4–W7 libs and routes.
5. Store + component tests (W1–W2, W5–W12, W14).
6. Playwright journeys.

## 6. Findings from reading the code (decide intent before writing tests)

- OTP: stored in plaintext in column `otp_hash`; `send-otp` has no rate limit; in-memory fallback has no attempt limit; `1234` works for everyone in production until `FAST2SMS_API_KEY` is set; four hard-coded demo phones always accept `1234`.
- `/api/pnr/verify` and `/api/flights/verify` need no session (cost/abuse surface for the paid AeroDataBox key).
- `sendRequest` does not verify both users share the trip.
- Profile save has no required-field validation.
- README and a store comment (`verifyTrip`) describe behaviour the code no longer has.
- "Download my data" only shows a toast.
- `jiti` used by a check script but not declared.
