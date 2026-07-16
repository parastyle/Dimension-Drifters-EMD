#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import {
  ASSIGNMENTS_AGGREGATE,
  readAssignment,
  writeAssignment,
  writeAssignmentsAggregate,
} from "./assignment-store.mjs";

if (!existsSync(ASSIGNMENTS_AGGREGATE)) {
  throw new Error(`legacy aggregate not found: ${ASSIGNMENTS_AGGREGATE}`);
}

const legacy = JSON.parse(readFileSync(ASSIGNMENTS_AGGREGATE, "utf8"));
if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) {
  throw new Error(`${ASSIGNMENTS_AGGREGATE} must contain a JSON object keyed by weapon id`);
}

let created = 0;
for (const [id, assignment] of Object.entries(legacy)) {
  const current = readAssignment(id);
  if (current) {
    if (!isDeepStrictEqual(current, assignment)) {
      throw new Error(
        `${id}.json already differs from the legacy aggregate; refusing to overwrite newer data`,
      );
    }
    continue;
  }
  writeAssignment(id, assignment);
  created++;
}

writeAssignmentsAggregate();
console.log(
  `migrated ${Object.keys(legacy).length} assignments (${created} created, ${
    Object.keys(legacy).length - created
  } already current)`,
);
