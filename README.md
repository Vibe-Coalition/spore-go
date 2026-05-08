<p align="center">
  <img src="assets/spore-logo.svg" alt="Spore logo" width="96" height="96"><br>
  <strong>Spore Go</strong><br>
  A mobile companion for staying connected to your Spore sessions.
</p>

<p align="center">
  <a href="https://github.com/Vibe-Coalition"><img alt="Vibe Coalition" src="https://img.shields.io/badge/Vibe%20Coalition-Spore%20Go-ff7a1a?style=for-the-badge"></a>
  <img alt="Status" src="https://img.shields.io/badge/status-in%20active%20development-2f855a?style=for-the-badge">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-2563eb?style=for-the-badge">
  <img alt="Vibe code welcome" src="https://img.shields.io/badge/vibe%20code-welcome-7c3aed?style=for-the-badge">
</p>

# Spore Go

## What this app is

`spore-go` is an Expo / React Native TypeScript client for Spore sessions. It
connects to a Spore Core server, authenticates a user, lists available sessions,
and opens a realtime chat surface for working with an agent from a phone,
emulator, or web build.

Spore Go is part of the Vibe Coalition Spore stack. The goal is simple: keep
the agent close when you are away from the desktop. Check in on a coding
session, answer a clarification, approve a plan, or talk to your own graph from
mobile without pretending the phone should replace the full terminal workflow.

This is a passion project and still under active development. PRs are welcome,
especially around mobile UX, connection reliability, session routing, theming,
notifications, and small vibe-coded experiments that make the companion app feel
more alive. Join the [Spore Discord](https://discord.gg/mtsQ6GrdsN) for project
chat and coordination.

The app is organized around a small screen flow:

1. Authenticate against a Spore Core server.
2. Load the available Spore Code sessions for that account.
3. Open a session and exchange messages over the Spore realtime event stream.

## Usage guide

### Prerequisites

- Node.js and npm.
- Expo-compatible development target: Expo Go, an Android emulator/device, an iOS simulator/device, or the Expo web target.
- Access to a running Spore Core server with a user account.

### Install

Install dependencies before starting the Expo dev server:

```sh
npm install
```

### Start the app

The project exposes the standard Expo scripts:

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Expo development server. |
| `npm run android` | Start the app for Android through Expo. |
| `npm run ios` | Start the app for iOS through Expo. |
| `npm run web` | Start the Expo web target. |

### First-run flow

1. Open the app.
2. Enter the Spore Core server URL, username, and password on the auth screen.
3. The auth service logs in and stores credentials/token data for later requests.
4. The session list screen fetches available Spore Code sessions from the server.
5. Select a session to open the chat screen.
6. The chat screen connects to the realtime event stream and sends messages/actions through the WebSocket service.

## Architecture overview

### Entry chain

The app starts at `index.ts`, which registers `App.tsx` with Expo. `App.tsx` wraps the UI in `SafeAreaProvider` and `AppProvider`, then renders the current screen through `AppContent`.

```text
index.ts -> App.tsx -> AppProvider -> AppContent screen router
```

`AppContent` reads global state from `useApp()` and routes between the main screens:

- no credentials: `AuthScreen`
- credentials with no active session: `SessionListScreen`
- active session selected: `ChatScreen`

### State and lifecycle

`src/context/AppContext.tsx` is the central state owner. It defines the app state shape, reducer actions, theme selection, font loading, credential/session state, message state, tool/question/approval state, and the WebSocket lifecycle.

`AppProvider` owns the active `SporeGoWebSocket` instance and exposes it through context along with state, dispatch, and theme values. Screens use that context rather than each screen owning independent server/session state.

## Screens

| Screen | File | Responsibility |
| --- | --- | --- |
| Auth | `src/screens/AuthScreen.tsx` | Collects server URL, username, and password; performs login; restores saved credentials where available. |
| Session list | `src/screens/SessionListScreen.tsx` | Fetches available Spore Code sessions and lets the user select one. |
| Chat | `src/screens/ChatScreen.tsx` | Main conversation surface for session messages, streaming output, tool status, plan approval, questions, and session actions. |
| Test | `src/screens/TestScreen.tsx` | Development/test surface used while building or checking UI behavior. |

## Services

| Service | File | Responsibility |
| --- | --- | --- |
| Auth/session API | `src/services/auth.ts` | Handles login, credential storage, token refresh, session fetching, and session actions. |
| Realtime events | `src/services/websocket.ts` | Defines `SporeGoWebSocket`, a reconnecting WebSocket client for Spore event streaming and outbound message/action sends. |
| Notifications | `src/services/notifications.ts` | Handles local notification permissions and agent-finished notifications. |

## Utilities

| Utility | File | Responsibility |
| --- | --- | --- |
| Questions | `src/utils/questions.ts` | Parses and normalizes plan-mode or agent question prompts for the UI. |
| Plans | `src/utils/plan.ts` | Parses plan-mode metadata and approval-oriented plan text. |
| Logo | `src/utils/logo.ts` | Provides logo/ASCII helpers used by the interface. |

## Repository structure

| Path | Purpose |
| --- | --- |
| `app.json` | Expo app configuration, including app name, slug, assets, and platform settings. |
| `index.ts` | Expo registration entrypoint. |
| `App.tsx` | Top-level app wrapper and screen router. |
| `assets/` | Static images and fonts used by the Expo app. |
| `src/components/` | Reusable React Native UI components such as backgrounds, sheets, markdown rendering, and loading/error states. |
| `src/context/` | Global app context, reducer state, theme, and WebSocket lifecycle management. |
| `src/screens/` | Screen-level UI for auth, session selection, chat, and testing. |
| `src/services/` | HTTP/auth/session APIs, realtime WebSocket connection, and notifications. |
| `src/types/` | Shared TypeScript types for API entities and UI state. |
| `src/utils/` | Parsing and display helpers shared across screens/components. |

## Developer workflow

### Common loop

1. Install dependencies with `npm install`.
2. Start the Expo server with `npm start`.
3. Choose Android, iOS, or web from the Expo UI/CLI, or run the target-specific npm script directly.
4. Make code or docs changes.
5. For docs-only changes, read the changed Markdown and inspect the git diff before committing.
6. For app changes, run the relevant Expo target and any available TypeScript or test checks before committing.

### Notes for contributors

- Keep server communication in `src/services/` and shared app/session state in `src/context/AppContext.tsx`.
- Prefer adding reusable UI pieces under `src/components/` instead of duplicating screen markup.
- Keep screen files focused on screen behavior and composition.
- Do not put secrets in `app.json` or other Expo public config. Expo config can be embedded into builds or exposed to runtime app code.
- Update this README when adding screens, services, commands, or user-visible workflow changes.

## Known docs caveats

- This documentation was written from static code inspection.
- The plan/research phase did not start Expo or run the app.
- Runtime behavior should only be described as tested after a verification command or manual run proves it.
