# Repository Guidelines

## Project Structure & Module Organization
- React renderer lives under `src/view`, grouped by feature (e.g., `features/search/pages/SearchPage.jsx`). Shared UI and logic components sit in `src/components`, `src/shared`, and `utils`.
- Electron main-process code is in `main.js`, preload integrations in `preload.js`, while Excel parsing resides in `searchLogic.js` and `src/main/features/search`.
- Static assets (fonts, images) are located in `src/assets` and `image/`. Build artifacts land in `dist/` after running the Vite build.

## Build, Test, and Development Commands
- `npm run start:dev` launches Vite and Electron together for interactive development.
- `npm run build` performs a production Vite build; run it before packaging or release testing.
- `npm run start` builds the renderer and then boots the packaged Electron shell.
- `npm run dist:win` bundles a Windows installer with electron-builder; confirm `dist/` is up to date first.

## Coding Style & Naming Conventions
- Use 2-space indentation for JavaScript/JSX. Prefer descriptive camelCase for variables and functions; React components remain PascalCase.
- Follow existing file naming: feature directories in kebab-case, files in PascalCase for components and camelCase for helpers.
- Run ESLint (`npx eslint src`) when touching complex logic; the project uses the config in `eslint.config.js`.

## Testing Guidelines
- Automated tests are not yet established; rely on manual verification within the Electron app.
- When adding logic-heavy modules, include ad-hoc scripts or console assertions and document follow-up test needs in the PR description.

## Commit & Pull Request Guidelines
- Write imperative, concise commit subjects (e.g., `Normalize file-type lookups in main process`). Group related file changes together.
- Pull requests should summarize motivation, list user-facing effects, and note manual test coverage. Attach screenshots or logs for UI regressions or IPC errors.
- Reference relevant issues or TODOs from `work.md` or `docs/` so maintainers can trace outstanding work.

## Security & Configuration Tips
- Configuration such as file path settings is persisted in `CONFIG_PATH`; avoid committing environment-specific copies.
- Never store production Excel data in the repo—load local paths via the in-app “경로 설정” workflow.
