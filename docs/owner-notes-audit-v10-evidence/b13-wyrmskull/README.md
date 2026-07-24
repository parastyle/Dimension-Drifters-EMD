# B13 Wyrmskull firing-frame live gate

The private-stack Playwright gate ran on client port `57213` and game port
`57212`; protected ports `5180` and `2567` were not used. The actor was
`proto-cowboy-hidden-face`, viewed both locally and remotely.

The machine-readable [live-gate.json](./live-gate.json) records four accepted
server attack cycles. All cycles were closed at idle, open within the
three-tick/150 ms release latch, and closed after it. The normalized grip error
was below `4e-15 px`; muzzle error was exactly `0 px`. Open-frame display width
and closed-return display width matched the idle frame in every capture.

| View | Facing | Closed idle | Open release | Closed after |
| --- | --- | --- | --- | --- |
| Local | Right | [PNG](./local-right-closed-idle.png) | [PNG](./local-right-open-release.png) | [PNG](./local-right-closed-after.png) |
| Local | Left | [PNG](./local-left-closed-idle.png) | [PNG](./local-left-open-release.png) | [PNG](./local-left-closed-after.png) |
| Remote | Right | [PNG](./remote-right-closed-idle.png) | [PNG](./remote-right-open-release.png) | [PNG](./remote-right-closed-after.png) |
| Remote | Left | [PNG](./remote-left-closed-idle.png) | [PNG](./remote-left-open-release.png) | [PNG](./remote-left-closed-after.png) |

Gate command:

```text
pnpm e2e -- b13-wyrmskull-firing-frame.spec.ts
```
