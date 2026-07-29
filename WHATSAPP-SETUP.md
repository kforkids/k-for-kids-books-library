# WhatsApp Notifications Setup (Reminders + OTP)

How to send WhatsApp messages (book due-date reminders and OTP) to library
members from the Google Apps Script backend, using the **Meta WhatsApp Cloud
API**.

> Google offers no SMS/WhatsApp API. Apps Script sends WhatsApp by calling
> Meta's Graph API over HTTP via `UrlFetchApp.fetch()`.

---

## Which path do you need?

| Path | Who you can message | Cost | Setup |
|---|---|---|---|
| **Free test number** | Up to **5** pre-verified numbers only | ₹0 | Minimal — no billing, no verification |
| **New dedicated number** (this doc) | **Any opted-in member** | Pay per message (~₹0.11–0.14) | Full — register new number + billing + verification |

The free test number is fine only for a fixed set of family members. To notify
**any library member who registers in the app**, you must use a real registered
number — the steps below.

> **This guide uses a NEW number dedicated to WhatsApp reminders + OTP**, so your
> existing WhatsApp Business number stays completely untouched (you keep using it
> on the WhatsApp Business app as normal). This is also simpler than migrating —
> no chat backup, no losing the app.

---

## Get a new number dedicated to WhatsApp API

### Choosing the number — key rule
> ⚠️ The number you register **must NOT be active on the WhatsApp or WhatsApp
> Business app.** A number can live in only one place — an app **or** the Cloud
> API, never both.

Good options for a fresh number:
- **A new SIM / mobile number** (prepaid is fine) that you have **never installed
  WhatsApp on**. Cheapest and easiest.
- **A second number on a dual-SIM phone**, as long as WhatsApp is not registered
  on it.
- **A landline / VoIP number** that can receive an SMS **or a voice call** (Meta
  verifies via either). The number only needs to receive the one-time
  verification code — it does **not** need to stay in a phone afterward; the
  Cloud API runs entirely in Meta's cloud.

You do **not** need to install WhatsApp on the new number. Just keep the SIM able
to receive the verification SMS/call during setup.

### Prerequisites
- A **Meta Business Portfolio** (Business Manager) — https://business.facebook.com
- A **Meta Developer app** (Business type) with the **WhatsApp** product added —
  https://developers.facebook.com — this creates your **WhatsApp Business
  Account (WABA)**.

### 1. Get the new number ready
- Have the new SIM/number reachable so it can receive an **SMS or voice call**
  with the verification code.
- Nothing to back up and nothing to disable — this is a clean number not tied to
  any WhatsApp app.

### 2. Add + verify the new number in WhatsApp Manager
- WhatsApp Manager → your WABA → **Phone numbers → Add phone number**.
- Enter a **display name** (e.g. "K for Kids Library") + business details.
- Enter the **new phone number**.
- **Verify ownership via OTP** — Meta sends a 6-digit code by **SMS or voice
  call** (pick voice if SMS is unreliable, e.g. a landline/VoIP number).
- **Set a 6-digit PIN** (two-step verification for the API number — store it
  safely) → the number is registered and live on the Cloud API.

### 3. Add billing (post-paid card)
- WhatsApp Manager → **Billing & payments** → add a **credit/debit card**,
  attach it to the WABA.
- Billing is **post-paid**: charges accrue and Meta bills at a threshold or
  month-end. **No monthly fee** — you pay only per message sent.
- India: billed in **INR**, plus **18% GST** on Meta's charges.

### 4. Submit Business Verification (needed for real scale)
- You **can start without it**, but you're then hard-capped at **250
  business-initiated conversations / 24h**. To send to a growing member base,
  verification is effectively required.
- Business Settings → **Security Center → Start Verification**. Choose business
  type **"Self-Employed"** if you're an individual.
- **Documents (India, individual/sole proprietor):** easiest is a **GST
  certificate**; alternatives are **Udyam/MSME registration** (free to obtain —
  cheapest route for an individual), **Shops & Establishment cert**, or
  **PAN + Aadhaar** with a utility bill / bank statement.
- ⚠️ The name on the document **must exactly match** your Meta Business
  Portfolio name.
- No registered business at all? Get a free **Udyam/MSME registration** first,
  otherwise you stay stuck at 250/24h.

### 5. Create message templates (get them approved)
Both reminders and OTP must be **pre-approved templates** because you are
initiating contact (free-form text only works within 24h of a user messaging you).

- **Reminder** → category **UTILITY**, e.g. `book_due_reminder`:
  > Hi {{1}}, your library book "{{2}}" is due on {{3}}. Please return or renew it.

  Provide example values for each variable, then submit. Approval usually takes
  minutes to a few hours.

- **OTP** → category **AUTHENTICATION**. Meta enforces a fixed structure
  (`{{1}} is your verification code`) plus a mandatory **"Copy code"** button.
  You supply only the code at send time. Approval is fast (often 1–2 hours).

⚠️ Keep templates plainly transactional. Marketing-flavored wording, placeholder
text, or missing variable examples are the common rejection causes.

### 6. Generate a permanent access token
The default token expires in ~24h and would break a scheduled reminder trigger.
Create a non-expiring **System User** token:
- Business Settings → **Users → System Users → Add** → role **Admin**.
- **Assign Assets** → your app + WABA → **Full control**.
- **Generate token** with permissions `whatsapp_business_messaging` +
  `whatsapp_business_management` → **copy it once** (shown only once).
- Store it in Apps Script **Script Properties** (`PropertiesService`), never
  hard-coded.
- Note your **Phone Number ID** and **WABA ID** — needed for API calls.

### 7. Send from Apps Script
`UrlFetchApp.fetch()` to the Graph API:

```
POST https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages
Authorization: Bearer <PERMANENT_TOKEN>
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "9198XXXXXXXX",                 // recipient, country code, no +
  "type": "template",
  "template": {
    "name": "book_due_reminder",
    "language": { "code": "en" },
    "components": [
      { "type": "body",
        "parameters": [
          { "type": "text", "text": "Aarav" },
          { "type": "text", "text": "The Gruffalo" },
          { "type": "text", "text": "tomorrow, 30 Jul" }
        ] }
    ]
  }
}
```

Works for **any opted-in member's number** — no 5-recipient cap once on a real
registered number.

---

## Cost (India, per delivered message, + 18% GST)

| Message type | Approx cost |
|---|---|
| **Utility** (book reminders) | ~₹0.11–0.12 |
| **Authentication** (OTP) | ~₹0.13–0.14 |
| **Service** (you reply within 24h of the member messaging you) | **Free** |

No monthly fee. A small library sending a few hundred reminders/month spends
roughly ₹20–50/month. ⚠️ Verify the live rate card at setup — Meta adjusts India
rates periodically.

---

## Rules to stay compliant
- **Opt-in is mandatory.** Keep a timestamped record of each member consenting
  to WhatsApp messages. Offer "reply STOP" to opt out.
- **No TRAI DLT needed** for WhatsApp — Meta's template approval replaces it.
  (DLT only matters if you add SMS fallback.)
- **Watch your quality rating** (Green/Yellow/Red). Blocks/reports lower it and
  throttle sending. Easy to keep green when messaging only opted-in members.
- **Messaging tiers auto-escalate** (250 → 1K → 10K → …) once verified, based on
  usage + good quality rating.

---

## Notes / corrections
- The old **"1,000 free messages/month"** perk was **removed (Nov 2024)**. Today
  only *service* messages (within the 24h window) are free; templates are billed
  per message.
- The two things you cannot skip to message arbitrary members: a **registered
  real number + billing** (removes the 5-recipient cap) and **business
  verification** (gets past 250/24h).
- Using a **new dedicated number** (not your existing WhatsApp Business number)
  keeps your current business number fully usable on the WhatsApp app — the two
  do not interfere. The only requirement is that the new number is **not**
  registered on any WhatsApp app.

---

## What you'll need on hand for the Apps Script integration
| Item | Where it comes from |
|---|---|
| Phone Number ID | WhatsApp API Setup page |
| WABA ID | WhatsApp API Setup page |
| Permanent token | System User (step 6) |
| Approved template names | WhatsApp Manager (step 5) |

_Research only — no app code has been changed. Rates and flows current as of
2025–2026; re-check Meta's docs at setup time._
