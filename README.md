# InMotion Agents

Brick 1 starter for the InMotion Agents SaaS platform.

## Current milestone

- Next.js + TypeScript app scaffold
- Internal AI agent simulator
- Demo business: Northstar Dental
- OpenAI server route
- Supabase client helpers
- Integration-first booking schema
- Native InMotion booking provider is the default, while Google/Outlook/Playtomic/Dineplan/custom adapters remain open

## Setup

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase URL, anon key, service role key and OpenAI API key.
3. Run the SQL in `supabase/migrations/0001_core.sql` in Supabase SQL Editor.
4. Install packages:
   `npm install`
5. Run:
   `npm run dev`
6. Open `http://localhost:3000` and ask: `What time do you close on Friday?`

## Environment variables

Never commit `.env.local`.

## Architecture rule

The AI talks to InMotion's standard business/booking interfaces, not directly to external calendar vendors. External providers will be implemented as adapters.
