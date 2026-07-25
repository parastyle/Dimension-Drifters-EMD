@echo off
REM CODEX FINAL RUN — Day 1 chain (§47). Every stage is RESUMABLE: re-running this file skips finished
REM renders. Log: tools/artkit/out/final-run-day1.log
cd /d "%~dp0..\.."
set LOG=tools\artkit\out\final-run-day1.log
echo === FINAL RUN DAY 1 start %date% %time% === >> %LOG%
echo --- P0.1 terrain kits + P0.5 menu key-art --- >> %LOG%
node tools\artkit\gen-terrain-kits.mjs >> %LOG% 2>&1
echo --- P0.2 themed decal packs --- >> %LOG%
for %%P in (decals-frostfell decals-verdant-ruins decals-ashlands decals-neon-cyber) do (
  echo pack %%P >> %LOG%
  node tools\artkit\gen-decals.mjs --pack=%%P >> %LOG% 2>&1
)
echo PHASE-P0-DONE %date% %time% >> %LOG%
echo --- P1.1 card factory (295) --- >> %LOG%
node tools\artkit\gen-card-factory.mjs >> %LOG% 2>&1
node tools\artkit\gen-card-manifest.mjs >> %LOG% 2>&1
echo PHASE-P1-DONE %date% %time% >> %LOG%
echo === FINAL RUN DAY 1 complete %date% %time% === >> %LOG%
