// Process pool for sims (tsx-forked workers; one per core).
import { ChildProcess, fork } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { GameResult, Side } from './match';

export interface Job { a: Side; b: Side; seed: number; log?: boolean }
let workers: ChildProcess[] = [];
let nextId = 1;

export function startPool(argv: string[], n = cpus().length, worker = './worker.ts') {
  const path = fileURLToPath(new URL(worker, import.meta.url));
  stopPool(); // never leak a previous pool's processes
  workers = Array.from({ length: n }, () => fork(path, argv, { execArgv: ['--import', 'tsx'] }));
}
export function stopPool() { for (const w of workers) w.kill(); workers = []; }

export async function runJobs<J = Job, R = GameResult>(jobs: J[]): Promise<R[]> {
  if (!workers.length) startPool(process.argv.slice(2));
  const chunk = Math.ceil(jobs.length / workers.length);
  const parts = await Promise.all(workers.map((w, i) => {
    const mine = jobs.slice(i * chunk, (i + 1) * chunk);
    if (!mine.length) return Promise.resolve([] as R[]);
    const id = nextId++;
    // A crashed worker (or a thrown game) must fail the run, not hang it forever.
    return new Promise<R[]>((res, rej) => {
      const cleanup = () => { w.off('message', on); w.off('exit', onExit); };
      const on = (m: { id: number; results?: R[]; error?: string }) => {
        if (m.id !== id) return;
        cleanup();
        if (m.error !== undefined) rej(new Error('sim worker: ' + m.error)); else res(m.results!);
      };
      const onExit = (code: number | null) => { cleanup(); rej(new Error(`sim worker exited (code ${code}) before replying`)); };
      w.on('message', on);
      w.on('exit', onExit);
      w.send({ id, jobs: mine });
    });
  }));
  return parts.flat();
}
