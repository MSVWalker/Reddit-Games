## Meme Gen (Reddit Game)

A Devvit-based meme generator that lets Redditors pick a template, add text, emojis, stickers, drawings, and extra images, then download or post the result. The app ships with a playful splash screen, gallery-driven template picker, and a full-screen canvas editor with draggable/rotatable layers.

### Features

- **Template gallery:** Popular meme bases ready to launch into the editor.
- **Rich canvas editor:** Drag, rotate, and resize text, emojis, stickers, and uploaded images.
- **Drawing tools:** Freehand strokes with undo plus custom brush size/color.
- **One-tap saving:** Export to image; Devvit hooks to create subreddit posts.

### Prerequisites

- Node.js **22.x**
- npm 10+
- [Devvit CLI](https://developers.reddit.com/docs/build/cli) installed and logged in (`npm run login`).

### Setup

1. Install dependencies (builds run after install):
   ```bash
   npm install
   ```
2. Create `.env` from the template and set your test subreddit:
   ```bash
   cp .env.template .env
   # edit DEVVIT_SUBREDDIT=r/your_subreddit
   ```
3. Start development (watches client + server and runs Devvit playtest):
   ```bash
   npm run dev
   ```

### Build & Deploy

- `npm run build` – Build client (`src/client`) and server (`src/server`).
- `npm run deploy` – Build then upload the Devvit app.
- `npm run launch` – Deploy and publish for review.

### Project Structure

- `src/client` – React + Vite front end, gallery (`Gallery.tsx`), and canvas editor (`Editor.tsx`).
- `src/server` – Express API for Devvit (init/increment/decrement plus post-creation hooks).
- `assets` – App icons, splash art, and meme templates.
- `devvit.json` – Devvit config (posts, server entry, menu, triggers, dev subreddit).

### Notes

- The client uses `/src/client/public` assets for templates and stickers; add new files there to surface in the gallery/editor.
- The server relies on Devvit `context` and Redis for counts and on-app-install post creation; ensure your subreddit allows the app to post.
