// Process pool for sims (tsx-forked workers; one per core).
import { ChildProcess, fork } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { GameResult, Side } from './match';

export interface Job { a: Side; b: Side; seed: number; log?: boolean }
let workers: ChildProcess[] = [];
let nextId = 1;

export function startPool(argv: string[], n = cpus().length) {
  const path = fileURLToPath(new URL('./worker.ts', import.meta.url));
  workers = Array.from({ length: n }, () => fork(path, argv, { execArgv: ['--import', 'tsx'] }));
}
export function stopPool() { for (const w of workers) w.kill(); workers = []; }

export async function runJobs(jobs: Job[]): Promise<GameResult[]> {
  if (!workers.length) startPool(process.argv.slice(2));
  const chunk = Math.ceil(jobs.length / workers.length);
  const parts = await Promise.all(workers.map((w, i) => {
    const mine = jobs.slice(i * chunk, (i + 1) * chunk);
    if (!mine.length) return Promise.resolve([] as GameResult[]);
    const id = nextId++;
    return new Promise<GameResult[]>((res) => {
      const on = (m: { id: number; results: GameResult[] }) => { if (m.id === id) { w.off('message', on); res(m.results); } };
      w.on('message', on);
      w.send({ id, jobs: mine });
    });
  }));
  return parts.flat();
}
