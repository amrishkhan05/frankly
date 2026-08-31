# Security

Frankly runs locally. It sends no source, diff, telemetry, embeddings, or model requests anywhere. The Claude plugin's first run installs Frankly's declared npm dependencies; analysis itself makes no network requests.

Frankly invokes Git with argument arrays, never a shell-built command. Optional test execution runs the repository's existing `test` script and therefore has the same trust implications as running `npm test` yourself.

Report vulnerabilities privately through GitHub Security Advisories. Do not include private repository contents in a public issue.
