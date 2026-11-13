import { ProtoJob, playProto } from './match';
process.on('message', (m: { id: number; jobs: ProtoJob[] }) => process.send!({ id: m.id, results: m.jobs.map(playProto) }));
