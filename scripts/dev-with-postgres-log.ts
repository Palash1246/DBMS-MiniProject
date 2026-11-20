import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const logDirectory = path.join(projectRoot, '.logs');
const logPath = path.join(logDirectory, 'postgres-session.log');
const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

mkdirSync(logDirectory, { recursive: true });
writeFileSync(
  logPath,
  `PostgreSQL query log started ${new Date().toISOString()}\nSQL parameters are omitted. This file is deleted when the dev server stops.\n\n`,
  'utf8',
);
console.log(`[postgres-log] Session log: ${logPath}`);
console.log('[postgres-log] SQL text will also appear in this terminal; parameter values are omitted.');

const server = spawn(process.execPath, [nextCli, 'dev', ...process.argv.slice(2)], {
  cwd: projectRoot,
  env: { ...process.env, POSTGRES_QUERY_LOG_PATH: logPath },
  stdio: 'inherit',
});

let cleaned = false;
let receivedSignal: NodeJS.Signals | undefined;

function cleanup(): void {
  if (cleaned) return;
  cleaned = true;
  if (existsSync(logPath)) unlinkSync(logPath);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    receivedSignal = signal;
    if (server.exitCode === null && server.signalCode === null) server.kill(signal);
  });
}

process.on('exit', cleanup);

server.once('error', (error) => {
  console.error('[postgres-log] Could not start Next.js:', error);
  cleanup();
  process.exitCode = 1;
});

server.once('exit', (code, signal) => {
  cleanup();
  process.exitCode = receivedSignal === 'SIGINT' || signal === 'SIGINT'
    ? 130
    : receivedSignal === 'SIGTERM' || signal === 'SIGTERM'
      ? 143
      : code ?? 1;
});
