<!-- @format -->

# Frankly

Use Frankly to challenge a code change with local repository evidence.

Before editing a task with uncertain scope, call `plan_change`. At a meaningful
completion checkpoint, call `analyze_change`. If it recommends a correction,
call `minimize_change`, make at most one evidence-backed correction, then call
`verify_change` with only tests actually executed.

Do not treat predicted tests as executed. Do not repeat a correction pass.
