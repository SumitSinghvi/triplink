# RailMeet - Indian Railways Co-Traveler & Networking Web App

> Connect with co-travelers on the same train & same date based on shared interests (Tech, Startups, Business, UPSC, Chai, Travel).

Built with **Next.js (App Router)** + **TypeScript** + **Tailwind CSS** + **Lucide Icons**.

---

## Key Features

1. **PNR & Journey Matching:**
   - **10-Digit PNR Verification & Simulator:** Automatically decodes train number, travel date, origin, destination, and coach.
   - **Zero Privacy Leakage:** Raw PNR is never exposed to public APIs or co-passengers. Only masked format (`28******51`) and coach details are visible.
   - **Manual Journey Entry Fallback:** Passengers can pick any train and date if PNR lookup is unavailable.

2. **Interest-Based Co-Traveler Discovery:**
   - Filter co-passengers by domain: *Tech & AI*, *Startups & Business*, *Finance*, *UPSC/Govt*, *Casual & Chai*, *Books & Ideas*, *Travel & Photography*.
   - **Coach-Aware Ranking:** Passengers in your coach or the next one rank higher. Coach numbers are never shown to others.
   - **Corridor Match Engine:** Solves the cold-start problem by displaying travelers taking the same route across alternative trains today.

3. **Train Lounge (Live Chat for Train & Date):**
   - Real-time discussion board restricted to passengers on that exact train and travel date.
   - Channel tags: `#All`, `#ChaiMeet`, `#Networking`, `#Food`, `#SeatSwap`.

4. **1-on-1 Connect & Direct Messaging:**
   - Send invites with Indian Railway icebreakers (*"Chai meetup around next junction"*, *"Quiet co-working buddy"*, *"Seat swap discussion"*).
   - Once accepted, passengers can directly chat 1-on-1 and opt-in to reveal their WhatsApp or LinkedIn details.

5. **Safety & Railway Guidelines:**
   - Indian Railway helpline **139** integration guide.
   - Safety instructions for meeting in public coach vestibules.

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build
```bash
npm run build
npm run start
```

---

### 4. Database Migrations

SQL migrations live in `supabase/migrations/`. Apply them in the Supabase SQL Editor (or `supabase db push`) in filename order.

**Applied (2026-11-14):** `20261114000000_trip_visibility_codes_profile_fields.sql` (adds trip visibility, station codes, social profile fields and a daily `pg_cron` cleanup of past trips). The app checks for these columns at runtime and falls back to the legacy columns on databases where the migration has not run.

## 1-Click Demo Testing
When opening the app, you can:
- Click **"Add PNR / Trip"** in top bar.
- Choose any 1-click test PNR chip (*Tejas Rajdhani NDLS-MMCT*, *Vande Bharat NDLS-BSB*, *Shatabdi SBC-MAS*).
- Use the **Demo Persona Switcher** inside the Profile modal to switch between passenger perspectives (*Aarav the Dev*, *Priya the PM*, *Vikram the Investor*, *Ananya the UPSC aspirant*).
