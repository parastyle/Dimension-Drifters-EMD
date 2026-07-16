@echo off
REM CODEX FINAL RUN - Day 2 preparation chain. Phase 1 is RESUMABLE; Phase 2 is intentionally TODO-only.
REM No weapon/enemy sprite render or harvest command is executed by this file.
REM Log: tools/artkit/out/final-run-day2.log
cd /d "%~dp0..\.."
set LOG=tools\artkit\out\final-run-day2.log
echo === FINAL RUN DAY 2 start %date% %time% === >> %LOG%
echo --- P1 particle expansion: 12 elements x 8 shapes = 96 packs --- >> %LOG%
node tools\artkit\gen-particle-packs.mjs >> %LOG% 2>&1
echo PHASE-P1-DONE %date% %time% >> %LOG%
echo --- P2 TODO missing weapon and enemy sprites --- >> %LOG%
echo TODO WEAPONS - render/promote from subjects-300.json, then key and harvest as weapon: >> %LOG%
echo   set "SUBJECTS=subjects-300.json" >> %LOG%
echo   node tools\artkit\orchestrate.mjs --promote=1 --only=x-sword-whirlwind,x-gun-hand-mortar,x-staff-arcane-lance,x-staff-storm-rod >> %LOG%
echo   node tools\artkit\guards\chroma-key.mjs --only=x-sword-whirlwind >> %LOG%
echo   node tools\artkit\guards\chroma-key.mjs --only=x-gun-hand-mortar >> %LOG%
echo   node tools\artkit\guards\chroma-key.mjs --only=x-staff-arcane-lance >> %LOG%
echo   node tools\artkit\guards\chroma-key.mjs --only=x-staff-storm-rod >> %LOG%
echo   node tools\artkit\harvest-install.mjs --ids=x-sword-whirlwind,x-gun-hand-mortar,x-staff-arcane-lance,x-staff-storm-rod --kind=weapon >> %LOG%
echo TODO ENEMIES - render/promote from subjects.concepts.json, then key and harvest as character: >> %LOG%
echo   set "SUBJECTS=subjects.concepts.json" >> %LOG%
echo   node tools\artkit\orchestrate.mjs --promote=1 --only=old-rust,world-titan,ronin,gatlin,vault-ronin,dust-ranger,dummy >> %LOG%
echo   node tools\artkit\guards\chroma-key.mjs --only=old-rust >> %LOG%
echo   node tools\artkit\guards\chroma-key.mjs --only=world-titan >> %LOG%
echo   node tools\artkit\guards\chroma-key.mjs --only=ronin >> %LOG%
echo   node tools\artkit\guards\chroma-key.mjs --only=gatlin >> %LOG%
echo   node tools\artkit\guards\chroma-key.mjs --only=vault-ronin >> %LOG%
echo   node tools\artkit\guards\chroma-key.mjs --only=dust-ranger >> %LOG%
echo   node tools\artkit\guards\chroma-key.mjs --only=dummy >> %LOG%
echo   node tools\artkit\harvest-install.mjs --ids=old-rust,world-titan,ronin,gatlin,vault-ronin,dust-ranger,dummy --kind=character >> %LOG%
echo PHASE-P2-DONE %date% %time% ^(TODO commands recorded; not executed^) >> %LOG%
echo === FINAL RUN DAY 2 complete %date% %time% === >> %LOG%
