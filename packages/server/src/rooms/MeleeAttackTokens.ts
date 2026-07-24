import { MELEE_ATTACK_TOKEN_CAP } from "@dd/shared";

/**
 * Server-private per-target melee commitment slots. The reverse index makes holder death/cancel cleanup
 * O(1), and a holder can never occupy more than one player's budget at once.
 */
export class MeleeAttackTokens {
  private readonly holdersByTarget = new Map<string, Set<string>>();
  private readonly targetByHolder = new Map<string, string>();

  constructor(readonly cap: number = MELEE_ATTACK_TOKEN_CAP) {}

  acquire(targetId: string, holderId: string): boolean {
    if (!targetId || !holderId || this.cap <= 0) return false;
    const currentTarget = this.targetByHolder.get(holderId);
    if (currentTarget === targetId) return true;
    if (currentTarget !== undefined) return false;
    let holders = this.holdersByTarget.get(targetId);
    if (!holders) {
      holders = new Set<string>();
      this.holdersByTarget.set(targetId, holders);
    }
    if (holders.size >= this.cap) return false;
    holders.add(holderId);
    this.targetByHolder.set(holderId, targetId);
    return true;
  }

  releaseHolder(holderId: string): boolean {
    const targetId = this.targetByHolder.get(holderId);
    if (targetId === undefined) return false;
    this.targetByHolder.delete(holderId);
    const holders = this.holdersByTarget.get(targetId);
    holders?.delete(holderId);
    if (holders?.size === 0) this.holdersByTarget.delete(targetId);
    return true;
  }

  releaseTarget(targetId: string): number {
    const holders = this.holdersByTarget.get(targetId);
    if (!holders) return 0;
    const released = holders.size;
    for (const holderId of holders) this.targetByHolder.delete(holderId);
    this.holdersByTarget.delete(targetId);
    return released;
  }

  targetOf(holderId: string): string | undefined {
    return this.targetByHolder.get(holderId);
  }

  count(targetId: string): number {
    return this.holdersByTarget.get(targetId)?.size ?? 0;
  }

  has(targetId: string, holderId: string): boolean {
    return this.holdersByTarget.get(targetId)?.has(holderId) === true;
  }

  clear(): void {
    this.holdersByTarget.clear();
    this.targetByHolder.clear();
  }
}
