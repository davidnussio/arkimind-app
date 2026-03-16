# Arkimind

A desktop app for classifying and archiving documents via Google Drive, built with Electrobun, React, Tailwind CSS, and Vite.

## Setup: Google OAuth Credentials

Arkimind requires a Google OAuth2 `credentials.json` file to access Google Drive.

> **⚠️ IMPORTANT: Never commit `credentials.json` to the repository.** It is listed in `.gitignore`.

1. Create a Google Cloud project at <https://console.cloud.google.com/>
2. Enable the **Google Drive API**
3. Create an **OAuth 2.0 Client ID** (Desktop app type) and download the JSON file
4. Place the file at `~/.arkimind/credentials.json` (the app looks for it there; do **not** place it inside this repository)

### Credential Lookup Order

Arkimind resolves OAuth credentials in this order:

1. `ARKIMIND_CREDENTIALS_PATH` (optional env var)
2. `GOOGLE_OAUTH_CREDENTIALS_PATH` (optional env var)
3. `~/.arkimind/credentials.json` (recommended canonical location)
4. `./credentials.json` (legacy fallback only)

### Distribution Strategy (Team / Production)

Use this approach to keep credentials out of source control and still let login work on every machine:

1. Store the Google OAuth desktop `credentials.json` in your secret manager / vault.
2. During onboarding or app provisioning, copy it to `~/.arkimind/credentials.json`.
3. Restrict permissions to the local user only:

```bash
mkdir -p ~/.arkimind
cp /secure/location/credentials.json ~/.arkimind/credentials.json
chmod 600 ~/.arkimind/credentials.json
```

4. Launch Arkimind and run login.

For managed environments, set `ARKIMIND_CREDENTIALS_PATH` to a company-managed secure path instead of copying into the home directory.

### Security Notes

- Never commit `credentials.json` (repo root fallback is for compatibility only).
- If a client secret was ever exposed in a repository, rotate it in Google Cloud Console.
- OAuth refresh tokens are stored locally in `~/.arkimind/arkidb.sqlite`.

## Getting Started

```bash
# Install dependencies
bun install

# Development without HMR (uses bundled assets)
bun run dev

# Development with HMR (recommended)
bun run dev:hmr

# Build for canary release
bun run build:canary

# Build for stable release
bun run build:stable
```

## How HMR Works

When you run `bun run dev:hmr`:

1. **Vite dev server** starts on `http://localhost:5173` with HMR enabled
2. **Electrobun** starts and detects the running Vite server
3. The app loads from the Vite dev server instead of bundled assets
4. Changes to React components update instantly without full page reload

When you run `bun run dev` (without HMR):

1. Electrobun starts and loads from `views://mainview/index.html`
2. You need to rebuild (`bun run build`) to see changes

## Project Structure

```
├── src/
│   ├── bun/
│   │   └── index.ts        # Main process (Electrobun/Bun)
│   └── mainview/
│       ├── App.tsx         # React app component
│       ├── main.tsx        # React entry point
│       ├── index.html      # HTML template
│       └── index.css       # Tailwind CSS
├── electrobun.config.ts    # Electrobun configuration
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind configuration
└── package.json
```

## Customizing

- **React components**: Edit files in `src/mainview/`
- **Tailwind theme**: Edit `tailwind.config.js`
- **Vite settings**: Edit `vite.config.ts`
- **Window settings**: Edit `src/bun/index.ts`
- **App metadata**: Edit `electrobun.config.ts`

## Security

The following files are excluded from version control via `.gitignore` and must **never** be committed:

| File / Pattern     | Why it is sensitive                                       |
| ------------------ | --------------------------------------------------------- |
| `credentials.json` | Contains Google OAuth2 client ID and client secret        |
| `*.sqlite`, `*.db` | Local database stores OAuth refresh tokens and API keys   |
| `.env`, `.env.*`   | May contain secrets or environment-specific configuration |
| `.DS_Store`        | macOS metadata that can reveal local directory structure  |
| `.claude/`         | Local AI developer tool configuration                     |

All user secrets (OAuth tokens, API keys) are stored exclusively in the local SQLite database at `~/.arkimind/arkidb.sqlite`, which is never part of the repository.
