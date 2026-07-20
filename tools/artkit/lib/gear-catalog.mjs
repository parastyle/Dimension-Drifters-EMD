import { readFileSync } from "node:fs";
import ts from "typescript";

function unwrapExpression(expression) {
  let current = expression;
  while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) {
    current = current.expression;
  }
  return current;
}

function propertyName(property) {
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
    return property.name.text;
  }
  throw new Error(`Unsupported computed property in GEAR_CATALOG: ${property.name.getText()}`);
}

function stringProperty(object, name, { optional = false } = {}) {
  const property = object.properties.find(
    (candidate) => ts.isPropertyAssignment(candidate) && propertyName(candidate) === name,
  );
  if (!property) {
    if (optional) return undefined;
    throw new Error(`GEAR_CATALOG row is missing ${name}`);
  }
  const value = unwrapExpression(property.initializer);
  if (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value)) {
    throw new Error(`GEAR_CATALOG ${name} must be a string literal`);
  }
  return value.text;
}

function assignedProperty(object, name, { optional = false } = {}) {
  const property = object.properties.find(
    (candidate) => ts.isPropertyAssignment(candidate) && propertyName(candidate) === name,
  );
  if (!property) {
    if (optional) return undefined;
    throw new Error(`GEAR_CATALOG row is missing ${name}`);
  }
  return unwrapExpression(property.initializer);
}

function trueFlagProperty(object, name) {
  const expression = assignedProperty(object, name, { optional: true });
  if (expression === undefined) return undefined;
  if (expression.kind !== ts.SyntaxKind.TrueKeyword) {
    throw new Error(`GEAR_CATALOG ${name} must be the literal true when declared`);
  }
  return true;
}

function numericLiteral(expression, label) {
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expression.operand)
  ) {
    return -Number(expression.operand.text);
  }
  throw new Error(`GEAR_CATALOG ${label} must be a numeric literal`);
}

function pointLiteral(object, name) {
  const expression = assignedProperty(object, name);
  if (!ts.isObjectLiteralExpression(expression))
    throw new Error(`GEAR_CATALOG ${name} must be an object literal`);
  return Object.freeze({
    x: numericLiteral(assignedProperty(expression, "x"), `${name}.x`),
    y: numericLiteral(assignedProperty(expression, "y"), `${name}.y`),
  });
}

function faceReceiversProperty(object) {
  const expression = assignedProperty(object, "faceReceivers", { optional: true });
  if (expression === undefined) return undefined;
  if (!ts.isObjectLiteralExpression(expression))
    throw new Error(`GEAR_CATALOG faceReceivers must be an object literal`);
  return Object.freeze({
    eyes: pointLiteral(expression, "eyes"),
    mouth: pointLiteral(expression, "mouth"),
  });
}

/**
 * Reads the checked-in TypeScript catalog directly so art generation cannot invent a second ID space.
 * Only fields needed by the art pipeline are projected; gameplay remains authoritative in gear.ts.
 */
export function readGearCatalog(catalogPath) {
  const source = ts.createSourceFile(
    catalogPath,
    readFileSync(catalogPath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let catalogExpression = null;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === "GEAR_CATALOG") {
        catalogExpression = declaration.initializer ? unwrapExpression(declaration.initializer) : null;
      }
    }
  }
  if (!catalogExpression || !ts.isObjectLiteralExpression(catalogExpression)) {
    throw new Error(`Could not read GEAR_CATALOG from ${catalogPath}`);
  }

  const rows = catalogExpression.properties.map((property) => {
    if (!ts.isPropertyAssignment(property)) {
      throw new Error(`GEAR_CATALOG may contain only explicit property assignments`);
    }
    const key = propertyName(property);
    const value = unwrapExpression(property.initializer);
    if (!ts.isObjectLiteralExpression(value)) {
      throw new Error(`GEAR_CATALOG ${key} must be an object literal`);
    }
    const id = stringProperty(value, "id");
    if (id !== key) throw new Error(`GEAR_CATALOG key/id mismatch: ${key} != ${id}`);
    const ornate = trueFlagProperty(value, "ornate");
    if (ornate && stringProperty(value, "slot") !== "torso") {
      throw new Error(`GEAR_CATALOG ornate is only valid for torso items: ${id}`);
    }
    return Object.freeze({
      id,
      name: stringProperty(value, "name"),
      slot: stringProperty(value, "slot"),
      rarity: stringProperty(value, "rarity"),
      effect: stringProperty(value, "effectText"),
      setId: stringProperty(value, "legacySetId", { optional: true }),
      originPool: stringProperty(value, "originPool", { optional: true }),
      faceReceivers: faceReceiversProperty(value),
      ...(ornate ? { ornate } : {}),
    });
  });

  const ids = new Set(rows.map((row) => row.id));
  if (ids.size !== rows.length) throw new Error(`GEAR_CATALOG contains duplicate ids`);
  return Object.freeze(rows);
}
