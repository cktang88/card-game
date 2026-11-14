// Forked sim worker: receives { jobs }, replies with results (same order).
import { applyFlags } from './flags';
import { Side, playGame } from './match';
applyFlags(process.argv);
process.on('message', (m: { id: number; jobs: { a: Side; b: Side; seed: number; log?: boolean }[] }) => {
  try {
    process.send!({ id: m.id, results: m.jobs.map((j) => playGame(j.a, j.b, j.seed, j.log)) });
  } catch (e) {
    process.send!({ id: m.id, error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
  }
});
