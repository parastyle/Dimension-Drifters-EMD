# B20 L2 private live-gate evidence

The private live transport gate ran `live-gate.mts` against an isolated Colyseus server on port
55109 while the isolated Vite client served successfully on port 55110. Neither protected port
5180 nor 2567 was used. The retained 165.11-second room (`Aeo-WsQNe`) records schema-35 chest rows,
ground/zone validation, two opener-instanced receipts for each of four chests,
weapon/relic/money categories, compact relic-HUD inputs, input continuity across OPEN, and an
authoritative Shuffle execution with the shared eight-tick dodge window.

Observed spawn ticks/zones were 500/Scar, 1821/Cover, 2735/Scar, and the locked weapon cache at
3000/Commons. All eight open receipts advanced input acknowledgement while the room outcome
remained active; both connected characters were `proto-cowboy-hidden-face`, and the artifact
contains no gate errors or open denials.

The connected visual browser surface was unavailable (`agent.browsers.list()` returned an empty
list after the required recovery check), so the browser skill prohibited substituting a separate
headless browser for screenshots. `live-observations.json` is the retained real-transport evidence;
the implementation report distinguishes this live state/action gate from the unavailable visual
screenshot capture.
