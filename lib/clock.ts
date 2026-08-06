/**
 * Injectable clock for session expiry and timestamps.
 * Production uses system time; tests inject a fixed/controllable clock.
 */

export type Clock = {
  now(): Date;
};

export const systemClock: Clock = {
  now: () => new Date(),
};
