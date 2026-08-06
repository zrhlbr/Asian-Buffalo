/**
 * Strict request validation utilities.
 *
 * Rules:
 * - Only whitelisted keys are allowed.
 * - Types are checked exactly: no Number()/Boolean() coercion.
 * - Strings must be string; numbers must be number and safe integer when required.
 * - Identifiers are checked against format rules (no whitespace, no leading/trailing
 *   spaces, regex character whitelist, length limits).
 * - Unknown fields are rejected and only a limited number are reported.
 */

export type ValidationErrorCode =
  | "INVALID_TYPE"
  | "MISSING_FIELD"
  | "UNKNOWN_FIELDS"
  | "STRING_EXPECTED"
  | "STRING_EMPTY"
  | "STRING_TOO_LONG"
  | "STRING_HAS_WHITESPACE"
  | "STRING_HAS_LEADING_TRAILING_SPACE"
  | "STRING_PATTERN_MISMATCH"
  | "NUMBER_EXPECTED"
  | "NUMBER_NOT_SAFE_INTEGER"
  | "NUMBER_OUT_OF_RANGE"
  | "BOOLEAN_EXPECTED"
  | "ENUM_MISMATCH"
  | "FORBIDDEN_FIELD";

export class ValidationError extends Error {
  code: ValidationErrorCode;
  field?: string;

  constructor(code: ValidationErrorCode, message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
    this.field = field;
  }
}

export type FieldValidator<T> = (key: string, value: unknown) => T;

export function stringField(minLen = 1, maxLen = Infinity): FieldValidator<string> {
  return (key, value) => {
    if (typeof value !== "string") {
      throw new ValidationError("STRING_EXPECTED", `${key} must be a string`, key);
    }
    if (value.length < minLen) {
      throw new ValidationError(
        "STRING_EMPTY",
        `${key} must be at least ${minLen} character(s)`,
        key,
      );
    }
    if (maxLen !== Infinity && value.length > maxLen) {
      throw new ValidationError(
        "STRING_TOO_LONG",
        `${key} must be at most ${maxLen} characters`,
        key,
      );
    }
    return value;
  };
}

export function enumStringField<T extends string>(allowed: readonly T[]): FieldValidator<T> {
  return (key, value) => {
    if (typeof value !== "string" || !allowed.includes(value as T)) {
      throw new ValidationError(
        "ENUM_MISMATCH",
        `${key} must be one of ${allowed.join(", ")}`,
        key,
      );
    }
    return value as T;
  };
}

export function intField(min = -Infinity, max = Infinity): FieldValidator<number> {
  return (key, value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new ValidationError("NUMBER_EXPECTED", `${key} must be a finite number`, key);
    }
    if (!Number.isSafeInteger(value)) {
      throw new ValidationError(
        "NUMBER_NOT_SAFE_INTEGER",
        `${key} must be a safe integer`,
        key,
      );
    }
    if (value < min || value > max) {
      throw new ValidationError(
        "NUMBER_OUT_OF_RANGE",
        `${key} must be between ${min} and ${max}`,
        key,
      );
    }
    return value;
  };
}

export function booleanField(): FieldValidator<boolean> {
  return (key, value) => {
    if (value !== true && value !== false) {
      throw new ValidationError("BOOLEAN_EXPECTED", `${key} must be a boolean`, key);
    }
    return value;
  };
}

export function optional<T>(validator: FieldValidator<T>): FieldValidator<T | undefined> {
  return (key, value) => {
    if (value === undefined) return undefined;
    return validator(key, value);
  };
}

export type IdentifierRules = {
  maxLen?: number;
  pattern?: RegExp;
  /** If true, reject any whitespace character anywhere in the string. */
  noWhitespace?: boolean;
  /** If true, reject leading or trailing space/tab/newline. */
  noLeadingTrailingSpace?: boolean;
};

export function identifierField(rules: IdentifierRules = {}): FieldValidator<string> {
  const maxLen = rules.maxLen ?? Infinity;
  const pattern = rules.pattern;
  const noWhitespace = rules.noWhitespace ?? true;
  const noLeadingTrailingSpace = rules.noLeadingTrailingSpace ?? true;

  return (key, value) => {
    if (typeof value !== "string") {
      throw new ValidationError("STRING_EXPECTED", `${key} must be a string`, key);
    }
    if (value.length === 0) {
      throw new ValidationError("STRING_EMPTY", `${key} must not be empty`, key);
    }
    if (maxLen !== Infinity && value.length > maxLen) {
      throw new ValidationError(
        "STRING_TOO_LONG",
        `${key} must be at most ${maxLen} characters`,
        key,
      );
    }
    if (noLeadingTrailingSpace && /^\s|\s$/.test(value)) {
      throw new ValidationError(
        "STRING_HAS_LEADING_TRAILING_SPACE",
        `${key} must not have leading or trailing whitespace`,
        key,
      );
    }
    if (noWhitespace && /\s/.test(value)) {
      throw new ValidationError(
        "STRING_HAS_WHITESPACE",
        `${key} must not contain whitespace`,
        key,
      );
    }
    if (pattern && !pattern.test(value)) {
      throw new ValidationError(
        "STRING_PATTERN_MISMATCH",
        `${key} has invalid format`,
        key,
      );
    }
    return value;
  };
}

const MAX_REPORTED_UNKNOWN_FIELDS = 5;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function validateObject<T extends Record<string, unknown>>(
  schema: { [K in keyof T]: FieldValidator<T[K]> },
  payload: unknown,
  context = "request",
): T {
  if (!isPlainObject(payload)) {
    throw new ValidationError(
      "INVALID_TYPE",
      `${context} must be a plain object`,
      context,
    );
  }

  const input = payload as Record<string, unknown>;
  const allowedKeys = new Set(Object.keys(schema));
  const unknownKeys = Object.keys(input).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    const shown = unknownKeys.slice(0, MAX_REPORTED_UNKNOWN_FIELDS);
    const suffix = unknownKeys.length > shown.length ? ` and ${unknownKeys.length - shown.length} more` : "";
    throw new ValidationError(
      "UNKNOWN_FIELDS",
      `${context} contains unknown fields: ${shown.join(", ")}${suffix}`,
      context,
    );
  }

  const result = {} as T;
  for (const key of Object.keys(schema) as Array<keyof T>) {
    const validator = schema[key];
    result[key] = validator(key as string, input[key as string]);
  }
  return result;
}

export function rejectFields(forbidden: readonly string[], payload: Record<string, unknown>, context = "request"): void {
  const found = forbidden.filter((key) => key in payload);
  if (found.length > 0) {
    const shown = found.slice(0, MAX_REPORTED_UNKNOWN_FIELDS);
    const suffix = found.length > shown.length ? ` and ${found.length - shown.length} more` : "";
    throw new ValidationError(
      "FORBIDDEN_FIELD",
      `${context} contains forbidden fields: ${shown.join(", ")}${suffix}`,
      context,
    );
  }
}
