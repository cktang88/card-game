// Shared sim flags, applied identically in the main process and in every worker.
import { CARDS } from '../shared/cards';
import { RULES, setCols } from '../shared/engine';
import { AI_TUNING } from '../shared/ai';

export function applyFlags(argv: string[]) {
  const val = (k: string) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
  if (val('cols')) setCols(Number(val('cols')));
  if (argv.includes('--no-formations')) RULES.formations = false;
  if (val('resolve')) RULES.startResolve = Number(val('resolve'));
  if (val('tactic-bonus')) AI_TUNING.tacticBonus = Number(val('tactic-bonus'));
  // --rule=key=value overrides RULES (numbers or true/false)
  for (const a of argv.filter((a) => a.startsWith('--rule='))) {
    const [k, v] = a.slice(7).split('=');
    (RULES as Record<string, unknown>)[k] = v === 'true' ? true : v === 'false' ? false : Number(v);
  }
  // --stat=faction[:Class].field+N : stat experiment on every unit of a faction (optionally one class)
  for (const a of argv.filter((a) => a.startsWith('--stat='))) {
    const m = a.slice(7).match(/^(\w+)(?::(\w+))?\.(\w+)([+-]\d+)$/);
    if (!m) throw new Error('bad --stat ' + a);
    for (const d of CARDS) {
      const r = d as unknown as Record<string, number>;
      if (d.faction === m[1] && d.cls !== 'Tactic' && (!m[2] || d.cls === m[2]) && r[m[3]] > 0) r[m[3]] += Number(m[4]);
    }
  }
}
