# Collaboration Guidelines 📚

<details>
<summary><strong>Table of Contents</strong></summary>

- [Code of Conduct](#code-of-conduct)
- [Branching Model](#branching-model)
- [Issue Reporting](#issue-reporting)
- [Pull Request Workflow](#pull-request-workflow)
- [Review Process](#review-process)
- [Commit Message Convention](#commit-message-convention)
- [Testing & CI](#testing--ci)
- [Release & Versioning](#release--versioning)
- [Community & Communication](#community--communication)
</details>

---

## Code of Conduct

We are committed to fostering a welcoming and inclusive environment. All contributors must:
- Respect each other's ideas and time.
- Use inclusive language; avoid harassing or offensive remarks.
- Follow the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

## Branching Model

- **`main`** – always stable and deployable.
- **Feature branches** – `feature/<short-descriptive-name>`.
- **Fix branches** – `fix/<short-descriptive-name>`.
- **Release branches** – `release/vX.Y.Z` (created by maintainers).

> Keep branches short‑lived; rebase onto `main` before opening a PR.

## Issue Reporting

1. Search existing issues before opening a new one.
2. Use the provided issue templates.
3. Include:
   - Clear title.
   - Description of the problem.
   - Steps to reproduce (if applicable).
   - Expected vs. actual behavior.
   - Environment details.

## Pull Request Workflow

1. Fork the repository (if you don't have write access).
2. Create a **feature/fix** branch from `main`.
3. Commit changes following the **Commit Message Convention** below.
4. Open a PR targeting `main`.
5. Fill out the PR template – describe **what**, **why**, and **how**.
6. Ensure all CI checks pass.
7. Request review from at least one maintainer.

## Review Process

- Reviewers should:
  - Verify functional correctness.
  - Check for style consistency (see `README` for UI guidelines).
  - Ensure tests are added/updated.
  - Suggest improvements, never blunt rejections.
- Contributors must address review comments promptly.

## Commit Message Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **scope**: optional, e.g., `readme`, `cli`
- **subject**: max 72 chars, imperative mood.
- **body**: why change was made, any background.
- **footer**: reference issues (`Closes #123`).

## Testing & CI

- All new code must include unit tests.
- Run `npm test` locally before pushing.
- CI (GitHub Actions) will run lint, test, and build on each PR.

## Release & Versioning

- Follow **Semantic Versioning** (MAJOR.MINOR.PATCH).
- Tag releases with `v<semver>` (e.g., `v1.1.0`).
- Draft release notes automatically from merged PR titles.

## Community & Communication

- Use the **#frankly** Discord channel for quick questions.
- For design discussions, open a discussion thread on GitHub.
- Be courteous, assume good intent, and help others get up to speed.

---

*Last updated: $(date '+%Y-%m-%d')*
