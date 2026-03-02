# React DevTools & Webpack Dev Server Fix Report

_Date: October 7, 2025_

## Summary
When we began this round of debugging, the Electron renderer (served from the webpack dev server) was crashing before React could mount, and the React DevTools Components panel was missing. This report documents every issue that was reported, the underlying cause we identified, and the concrete actions taken to restore a stable developer experience.

## Issue Log

| # | User-Reported Issue | Root Cause | Actions Taken | Outcome |
|---|---------------------|------------|---------------|---------|
| 1 | **`jsonp chunk loading:42 Uncaught ReferenceError: global is not defined`** appearing immediately in the renderer console. | The renderer bundle was generated with the Electron target, so the webpack runtime tried to reference the Node-style `global` symbol before our entry code executed. | • Added a defensive shim in `src/renderer/index.tsx` that assigns `globalThis.global = globalThis` when absent.<br>• Updated `webpack.renderer.config.js` so `output.globalObject` points to `globalThis`, ensuring the runtime uses a browser-safe global early in execution. | Dev server bundles now evaluate without the `global` ReferenceError, allowing subsequent modules to load. |
| 2 | **`Uncaught ReferenceError: require is not defined` originating from `webpack/hot/emitter.js`** after the first fix. | Remaining Electron-specific bundling kept the output in CommonJS mode and marked `electron` as an external, causing webpack-dev-server’s HMR client (which expects `require`) to fail in the browser sandbox. | • Switched the renderer build to `target: 'web'` and removed the `externals.electron` override in `webpack.renderer.config.js`.<br>• Confirmed the bundle still resolves Electron dependencies via preload bridges rather than runtime requires. | Webpack dev server and HMR start cleanly; navigating to `http://localhost:3000` inside Electron now shows the login screen instead of a 404 or runtime crash. |
| 3 | **React DevTools Components panel missing even though the extension was installed.** | The Content-Security-Policy applied to the renderer blocked `chrome-extension://` / `devtools://` scripts and the websocket connection back to the dev server, preventing the DevTools hook from injecting. | • Introduced a development-only CSP relaxation in `WindowManager.createMainWindow`, adding extension protocols to `script-src`/`style-src` and allowing `localhost:3000` over HTTP/WS.<br>• Kept the stricter policy for production builds to preserve security posture. | React DevTools attaches successfully; user confirmed the Components tab appears while running against the webpack dev server. |

## Files Updated
- `apps/desktop/src/renderer/index.tsx` – Added a `globalThis` shim so the JSONP loader finds a `global` reference during dev-server boot.
- `apps/desktop/webpack.renderer.config.js` – Re-targeted the renderer for the browser, set `output.globalObject` to `globalThis`, and removed the Electron external.
- `apps/desktop/src/main/services/windowManager.ts` – Relaxed CSP rules in development to allow React DevTools and webpack-dev-server traffic while keeping production rules locked down.

## Verification
- User re-ran `npm run dev` after each change and confirmed the renderer no longer throws runtime errors, the login page renders, and React DevTools is now usable.
- No automated lint/tests were executed during these fixes; see `npm run lint` output (separate discussion) for outstanding unrelated warnings.

## Follow-Up Considerations
- Harmonize tooling by upgrading `@typescript-eslint/*` to versions compatible with TypeScript 5.8 or pin TypeScript to a supported version (see latest lint findings).
- Evaluate whether additional CSP entries are required for other browser extensions or local tooling while keeping production constraints strict.
