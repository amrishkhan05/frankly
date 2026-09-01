# Contributing

## Overview
We welcome contributions from the community! This guide helps you get set up quickly and follow our workflow.

## Prerequisites
- **Node.js** version 20 or newer
- **Git** installed and configured with your GitHub account

## Local Setup
```bash
# Clone the repo
git clone https://github.com/amrishkhan05/frankly.git
cd frankly

# Install dependencies
npm install
```

## Development Workflow
1. **Create a branch**
   ```bash
   git checkout -b feature/<short-descriptive-name>
   ```
2. **Make changes** and ensure they are lint‑free.
3. **Run tests** before committing:
   ```bash
   npm test
   ```
4. **Commit** using the conventional commit format (see below).
5. **Push** and open a Pull Request targeting `main`.

## Linting & Formatting
We enforce consistent style with ESLint and Prettier.
```bash
npm run lint   # check linting errors
npm run fmt    # apply Prettier formatting
```
Make sure the CI passes before merging.

## Commit Message Convention
```
<type>(<scope>): <subject>

<body>

<footer>
```
- **type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **scope**: optional, e.g., `cli`, `readme`
- **subject**: concise, imperative, ≤72 characters
- **body**: optional, explains *why* the change was made
- **footer**: reference issues, e.g., `Closes #123`

## Pull Request Template
When opening a PR, fill out the automatically provided template:
- **What does this PR do?**
- **Why is it needed?**
- **How was it tested?**
- **Related issues** (if any)

## Review Process
- At least one maintainer must review and approve.
- Reviewers check functionality, style, tests, and documentation.
- Address review comments promptly.

## Testing Guidelines
- Add unit tests for new functionality.
- Run `npm test` locally; CI will run the same suite.
- Aim for high coverage; avoid flaky tests.

## Community & Communication
- Use the **#frankly** Discord channel for quick questions.
- Open GitHub Discussions for design or architectural topics.
- Be respectful and assume good intent.

---
*Last updated: $(date '+%Y-%m-%d')*
