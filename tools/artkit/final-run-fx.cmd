@echo off
REM §48 bespoke weapon-FX component packs — resumable; log: tools/artkit/out/final-run-fx.log
cd /d "%~dp0..\.."
set LOG=tools\artkit\out\final-run-fx.log
echo === FX PACKS start %date% %time% === >> %LOG%
for %%P in (fx-nuke fx-lightning-ball fx-frost-nova fx-void-implosion fx-holy-smite fx-toxic-burst fx-ember-eruption fx-storm-call fx-buzzsaw-wake fx-tide-crash fx-quake-burst fx-grave-call) do (
  echo pack %%P >> %LOG%
  node tools\artkit\gen-decals.mjs --pack=%%P >> %LOG% 2>&1
)
echo PHASE-FX-DONE %date% %time% >> %LOG%
