#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import {
  ASSIGNMENTS_AGGREGATE,
  aggregateAssignmentsText,
  readAssignments,
  writeAssignmentsAggregate,
} from "./assignment-store.mjs";

const check = process.argv.includes("--check");
const expected = aggregateAssignmentsText();
const count = Object.keys(readAssignments()).length;

if (check) {
  const actual = existsSync(ASSIGNMENTS_AGGREGATE)
    ? readFileSync(ASSIGNMENTS_AGGREGATE, "utf8")
    : "";
  if (actual !== expected) {
    console.error(
      "assignments.json is stale; run `pnpm weaponsmith:aggregate` and commit the result.",
    );
    process.exitCode = 1;
  } else {
    console.log(`assignments.json is current (${count} weapons)`);
  }
} else {
  writeAssignmentsAggregate();
  console.log(`wrote assignments.json from ${count} per-weapon files`);
}
