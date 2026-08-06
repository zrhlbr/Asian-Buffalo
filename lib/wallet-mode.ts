/**
 * REAL / TEST wallet gates.
 * REAL money paths fail closed unless explicitly allowed.
 */

export type WalletMode = "TEST" | "REAL";

export class WalletModeGateError extends Error {
  readonly failClosed = true as const;
  constructor(message: string) {
    super(message);
    this.name = "WalletModeGateError";
  }
}

export function assertTestWalletAllowed(mode: WalletMode): void {
  if (mode !== "TEST") {
    throw new WalletModeGateError("TEST wallet operations require WalletMode=TEST");
  }
}

/** REAL adapter skeleton must call this; default deny. */
export function assertRealWalletAllowed(mode: WalletMode, allowRealMoney: boolean): void {
  if (mode !== "REAL") {
    throw new WalletModeGateError("REAL wallet operations require WalletMode=REAL");
  }
  if (!allowRealMoney) {
    throw new WalletModeGateError("REAL money is fail-closed (allowRealMoney=false)");
  }
}
