import { ProtoJob, playProto } from './match';
process.on('message', (m: { id: number; jobs: ProtoJob[] }) => {
  try { process.send!({ id: m.id, results: m.jobs.map(playProto) }); }
  catch (e) { process.send!({ id: m.id, error: e instanceof Error ? (e.stack ?? e.message) : String(e) }); }
});
