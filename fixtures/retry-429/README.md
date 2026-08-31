# Retry HTTP 429 fixture

This fixture represents an overly broad AI-generated candidate patch for the task
"Retry HTTP 429 responses." The baseline already has a retry policy; the candidate
replaces it with a single-use abstraction and adds an unrelated file.

`npm run demo` copies `baseline/` into a temporary Git repository, commits it, then
overlays `candidate/` before running Frankly's analysis.