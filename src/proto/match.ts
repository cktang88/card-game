import { ProtoRules, Side, newProto, resolve } from './core';
import { PDecStats, protoOrders } from './ai';

export type Level = 'steel' | 'greedy' | 'random';
export interface ProtoJob { rules: ProtoRules; levels: [Level, Level]; seed: number; log?: boolean }
export interface ProtoResult {
  winner: null | -1 | Side; rounds: number; leadChanges: number; decidedRound: number; behindMid: -1 | Side;
  routs: number; kills: number; maxWave: number; stakeHits: number; dec: PDecStats; log?: string[];
}

export function playProto(j: ProtoJob): ProtoResult {
  const s = newProto(j.rules, j.seed);
  const dec: PDecStats = { decisions: 0, close: 0, obvious: 0 };
  const diffs: number[] = [];
  let behindMid: -1 | Side = -1;
  const mid = Math.ceil(j.rules.rounds / 2);
  const log: string[] = [];
  while (s.winner === null && s.round <= j.rules.rounds) {
    const d = s.markers[1] - s.markers[0]; // >0: P0 ahead
    diffs.push(d);
    if (s.round === mid + 1 && d !== 0) behindMid = d > 0 ? 1 : 0;
    const o0 = protoOrders(s, 0, j.levels[0], dec), o1 = protoOrders(s, 1, j.levels[1], dec);
    const before = s.log.length;
    resolve(s, [o0, o1], true);
    if (j.log) log.push(`R${s.winner === null ? s.round - 1 : s.round}: P0 ${JSON.stringify(o0)} | P1 ${JSON.stringify(o1)}`, ...s.log.slice(before), `  markers ${s.markers.join('-')}`);
  }
  diffs.push(s.markers[1] - s.markers[0]);
  let leadChanges = 0, last = 0;
  for (const d of diffs) { const sg = Math.sign(d); if (sg && last && sg !== last) leadChanges++; if (sg) last = sg; }
  let decidedRound = 1;
  if (s.winner === 0 || s.winner === 1) { const sg = s.winner === 0 ? 1 : -1; for (let i = 0; i < diffs.length; i++) if (Math.sign(diffs[i]) !== sg) decidedRound = i + 2; decidedRound = Math.min(decidedRound, s.round); }
  return { winner: s.winner, rounds: s.round, leadChanges, decidedRound, behindMid, routs: s.stats.routs, kills: s.stats.kills, maxWave: s.stats.maxWave, stakeHits: s.stats.stakeHits, dec, log: j.log ? log : undefined };
}
