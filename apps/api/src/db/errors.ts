interface DatabaseErrorLike {
  code?: unknown;
  constraint?: unknown;
  cause?: unknown;
}

/**
 * Drizzle wraps driver failures in a `DrizzleQueryError` whose `cause` is the
 * original `pg` error, so constraint checks have to walk the cause chain.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as DatabaseErrorLike;

  if (candidate.code === '23505' && candidate.constraint === constraint) {
    return true;
  }

  return isUniqueViolation(candidate.cause, constraint);
}

/**
 * A Postgres exclusion constraint fired. The bookings table uses one to make
 * overlapping confirmed bookings impossible regardless of the writer, so this
 * is the race-safe signal behind `SLOT_TAKEN`.
 */
export function isExclusionViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as DatabaseErrorLike;

  if (candidate.code === '23P01') {
    return true;
  }

  return isExclusionViolation(candidate.cause);
}
