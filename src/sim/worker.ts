// Forked sim worker: receives { jobs }, replies with results (same order).
import { applyFlags } from './flags';
import { Side, playGame } from './match';
applyFlags(process.argv);
process.on('message', (m: { id: number; jobs: { a: Side; b: Side; seed: number; log?: boolean }[] }) => {
  const results = m.jobs.map((j) => playGame(j.a, j.b, j.seed, j.log));
  process.send!({ id: m.id, results });
});
