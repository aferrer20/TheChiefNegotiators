# Camila — First Month List

Running list of things to hand off. Adding to this as they come up.

## Site / tooling

- **Check the bulk-upload tool's host setting.** `github.md` (the sync log the "Add files via upload" tool writes on each push) was set to `host: Vercel`, but the live domain actually resolves to GitHub Pages (`aferrer20.github.io`). That mismatch is what caused `vercel.json` to get added to the repo even though it does nothing in production. Fixed the log and removed the dead config on 2026-09-08, but the upload tool itself needs its host setting corrected, or the same file will likely reappear next time someone pushes through it.
