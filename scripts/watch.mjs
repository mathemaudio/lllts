import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const children = [];
let isShuttingDown = false;

startChild(
	'typescript',
	process.execPath,
	[path.join(projectRoot, 'node_modules', 'typescript', 'lib', 'tsc.js'), '--watch'],
	{
		...process.env,
		TSC_NONPOLLING_WATCHER: '1'
	}
);

startChild(
	'overlay-runtime',
	process.execPath,
	[path.join(projectRoot, 'scripts', 'build-overlay-runtime.mjs'), '--watch'],
	process.env
);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

await new Promise(() => {});

function startChild(name, command, args, env) {
	const child = spawn(command, args, {
		cwd: projectRoot,
		env,
		stdio: 'inherit'
	});
	children.push(child);
	child.on('exit', (code, signal) => {
		if (isShuttingDown) {
			return;
		}
		if (signal && signal !== 'SIGTERM' && signal !== 'SIGINT') {
			console.error(`[watch] ${name} exited from signal ${signal}`);
			shutdown(1);
			return;
		}
		if (typeof code === 'number' && code !== 0) {
			console.error(`[watch] ${name} exited with code ${code}`);
			shutdown(code);
			return;
		}
		console.error(`[watch] ${name} exited`);
		shutdown(0);
	});
}

function shutdown(exitCode) {
	if (isShuttingDown) {
		return;
	}
	isShuttingDown = true;
	for (const child of children) {
		if (!child.killed) {
			child.kill('SIGTERM');
		}
	}
	process.exit(exitCode);
}
