# Step 1 API

Base path: `/v1`. Web proxy: `/api/v1`. Responses have `Cache-Control: no-store`.
Every mutation requires the exact configured `Origin`. Authenticated mutations
also require `X-CSRF-Token` from the private session response.

| Method | Path | Access | Behaviour |
| --- | --- | --- | --- |
| GET | /health | Public | API health |
| GET | /availability | Public | Truthful development/no-staff service state |
| POST | /access | Public, origin checked | Create pseudonymous session and one-time displayed recovery code |
| POST | /access/recover | Public, origin checked | Resume account and revoke earlier sessions |
| GET | /me | Session | Own minimal account, CSRF token and expiry |
| POST | /access/logout | Session + CSRF | Revoke this session |
| POST | /requests | Session + CSRF | Create own encrypted request |
| GET | /requests | Session | List only own requests |
| GET | /requests/:id | Session | Read own request, otherwise 404 |
| POST | /requests/:id/pause | Session + CSRF | Pause own request, otherwise 404 |
| POST | /professional-applications | Session + CSRF | Create pending application with encrypted claims |
| GET | /professional-applications | Session | List own application summaries |
| GET | /professional/assigned-requests | Session | Always 403 in step 1 |

Input schemas live in `packages/contracts/src/index.ts`. Use synthetic examples.
Staff login validation lives in `apps/api/src/staff-password.ts`.

Step 2A staff routes use a separate staff cookie and CSRF token:

| Method | Path | Access | Behaviour |
| --- | --- | --- | --- |
| POST | /staff/login | Public, exact Origin, throttled | Strict username/password login; no role input |
| GET | /staff/me | Active staff session | Minimal identity, current role, CSRF and expiry |
| POST | /staff/logout | Staff session + Origin + CSRF | Revoke staff session |
| GET | /staff/workspace/verification_reviewer | Verification reviewer | Synthetic workspace status only |
| GET | /staff/workspace/safeguarding_lead | Safeguarding lead | Synthetic workspace status only |
| GET | /staff/workspace/administrator | Administrator | Synthetic workspace status only |

No public provisioning or staff registration endpoints exist. See STAFF_AUTH.md.
Notice acknowledgement is a required intake gate. It is not consent for external
referrals, clinical treatment, or police reporting. Those endpoints do not exist.

Pending requests have `received` or `paused` status. Appointment, referral,
complaint submission, community, live messages, reviewer approval and file upload
endpoints remain unimplemented and cannot be mistaken for completed integrations.
