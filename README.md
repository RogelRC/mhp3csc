# MHP3 Armor Set Search

> An advanced armor set and charm skill calculator for **Monster Hunter Portable 3rd** (PSP).

[![Production](https://img.shields.io/badge/Live-https%3A%2F%2Fmhp3csc.vercel.app-blue?style=flat-square&logo=vercel&logoColor=white&label=Production)](https://mhp3csc.vercel.app/)
[![Visitors](https://mhp3csc.vercel.app/api/analytics/visitors.svg)](https://vercel.com/dashboard)
[![Page Views](https://mhp3csc.vercel.app/api/analytics/pageviews.svg)](https://vercel.com/dashboard)

**MHP3 Armor Set Search** is a client-side tool that finds every armor set that activates the skills you want. Pick your skill targets, optional charms, weapon slots and hunter type, and the built-in search engine enumerates all viable combinations — with decorations, charm/table names, materials, defense and resistance breakdowns.

---

## ✨ Features

- **Complete MHP3rd data** — all armor pieces (Blademaster/Gunner, both genders), decorations, skill trees and charms, including **Torso Up** piercing pieces.
- **Skill target search** — select any skill (or several) and get every set that reaches the required point thresholds, including activated and negative skills.
- **Save file import** — upload your `Save.BIN` and the app decrypts the PSP/Game save and imports **all of your charms** automatically.
- **Hypothetical charm search** — find what's _possible_ even without owning the charm: `1 skill`, `2 skills`, or `slotted` charm modes.
- **Flexible constraints** — weapon slots, gender, max rarity, max HR / village stars, and Torso Up toggles.
- **Decorations & materials** — decorations are applied automatically and every result lists the required craft materials.
- **Most-searched sets** — anonymous, aggregated leaderboard of the most popular searches (persisted in Upstash Redis).
- **Search history** — your past searches are saved locally so you can re-run them instantly.
- **Export as image** — render any result set to a PNG to share with friends.
- **Live analytics** — visitors and page views tracked with Vercel Web Analytics and Speed Insights.

## 🚀 Production

The app is deployed and live on Vercel:

<p align="center">
  <a href="https://mhp3csc.vercel.app/"><strong>https://mhp3csc.vercel.app/</strong></a>
</p>

### Live Vercel Analytics

Badges below are generated on the fly from the [Vercel Web Analytics API](https://vercel.com/docs/analytics/web-analytics-api) and update automatically:

| Metric                        | Badge                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Visitors** (last 30 days)   | [![Visitors](https://mhp3csc.vercel.app/api/analytics/visitors.svg)](https://mhp3csc.vercel.app/api/analytics)    |
| **Page views** (last 30 days) | [![Page Views](https://mhp3csc.vercel.app/api/analytics/pageviews.svg)](https://mhp3csc.vercel.app/api/analytics) |

The raw data is also available as JSON at [`/api/analytics`](https://mhp3csc.vercel.app/api/analytics).

## 🧰 Tech Stack

- **[SvelteKit](https://kit.svelte.dev/)** — full-stack framework
- **[Svelte 5](https://svelte.dev/)** — runes-based reactivity
- **[Tailwind CSS](https://tailwindcss.com/)** — styling
- **[Upstash Redis](https://upstash.com/)** — top-sets leaderboard + analytics cache
- **[Vercel Analytics](https://vercel.com/analytics)** & **[Speed Insights](https://vercel.com/speed-insights)** — traffic and performance monitoring
- **[TypeScript](https://www.typescriptlang.org/)** — type-safe data model
- **[Prettier](https://prettier.io/)** & **[ESLint](https://eslint.org/)** — code quality

## 📦 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+ and npm

### Local development

```sh
# install dependencies
npm install

# copy and configure environment variables
cp .env.example .env

# start the dev server
npm run dev

# or start and open in the browser
npm run dev -- --open
```

### Scripts

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Start the development server             |
| `npm run build`         | Build the production bundle              |
| `npm run preview`       | Preview the production build locally     |
| `npm run check`         | Type-check with `svelte-check`           |
| `npm run lint`          | Run Prettier and ESLint                  |
| `npm run format`        | Auto-format the codebase                 |
| `npm run reset:topsets` | Clear the most-searched sets leaderboard |

### Live analytics (optional)

For the analytics badges to show real numbers you must configure these environment variables in Vercel:

| Variable            | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `VERCEL_TOKEN`      | A Vercel API token with Web Analytics read access                       |
| `VERCEL_PROJECT_ID` | The Vercel project identifier (`prj_…`)                                 |
| `VERCEL_TEAM_ID`    | _(optional)_ The team identifier, only if the project belongs to a team |

The badges fall back to a neutral “—” value when these are missing, so the site still works without them.

## 🏗️ Project Structure

```
src/
├── lib/
│   ├── components/      # CharmCard, ResultCard components
│   ├── mh3/             # PSP save cipher, charm parser, charm/skill tables
│   ├── server/          # Upstash Redis integration (top sets, analytics cache)
│   ├── gameData.ts      # Armor, decoration, skill data loaders
│   ├── search.ts        # The set search engine
│   └── types.ts         # Shared TypeScript types
├── mhp3_json/           # Game data (armors, skills, decorations, …)
└── routes/
    ├── +page.svelte     # Main app
    └── api/
        ├── analytics/   # Live analytics badges + JSON
        ├── search-log/  # Records successful searches
        └── top-sets/    # Most-searched sets leaderboard
```

## 🤝 Contributing

Bug reports, feature ideas and pull requests are welcome. If you find a bug, please [report it on Discord](https://discord.com/users/1136464673479340203).

## 📄 License

This project is a fan-made tool for _Monster Hunter Portable 3rd_ (© CAPCOM). It is not affiliated with or endorsed by CAPCOM. All game data belongs to their respective owners.
