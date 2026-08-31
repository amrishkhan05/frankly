---
name: frankly
description: Plan, review, minimize, and verify code changes with local repository evidence.
---

# Frankly

Before editing, call `plan_change` with the user's task when scope is uncertain.

At a meaningful completion checkpoint, call `analyze_change`. If its verdict warrants correction, follow the single correction instruction returned by `minimize_change`, preserving requested behavior and safety checks. Then call `verify_change` once with any tests actually executed.

Never describe predicted tests as executed. Never repeat a correction pass.
