# B47 Studio transforms evidence

The Pose Studio and weaponsmith API ran on private ports 57643 and 57642. The retained
`round-trip.json` records a real API save of move, rotate, and scale values at whole-hold, held-pose,
and beat-0 scopes; a subsequent GET returned the identical nested transform object. The API snapshot
restore returned the initial row, and the catalog was restored to its exact Git HEAD bytes.

The production page and its `main.ts` module both returned HTTP 200. The proof run's API and UI error
logs were both empty.

## Browser-runtime limitation

The required connected Browser runtime was initialized according to its skill instructions, but
reported `No browser is available`; its browser listing was empty. The skill explicitly disallows
substituting a separate browser automation stack, so no synthetic screenshot was created. UI behavior
is instead covered by the production client build, transform resolver/census tests, the Pose Studio
save/reload test, and the live private-port API proof above.
