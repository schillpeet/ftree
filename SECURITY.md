# Security policy

## Supported versions

Only the latest release gets security fixes; production follows it automatically.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: on the [Security tab](https://github.com/schillpeet/ftree/security), choose **Report a vulnerability**.
Do not open a public issue or pull request for it.

Include what is affected (UI, BFF, API, Helm chart), how to reproduce it, and what an attacker gains.
ftree is maintained in spare time: expect an answer within a week and a fix or a decision within 30 days.
Once a fix is released, the advisory is published, and you are credited unless you prefer not to be.

## Scope

In scope: the code in this repository and the published images and Helm chart.
Out of scope: Cloudflare Access, GitHub, and other third-party services, denial of service by volume, and findings that need a compromised admin account.
Please test only against a local setup (`./start.sh`), not against an instance someone else runs.
