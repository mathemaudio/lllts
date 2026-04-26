import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDirectory, '..');
const entryPoint = path.join(packageRoot, 'dist-many', 'LLLTS.lll.js');
const outputDirectory = path.join(packageRoot, 'dist');
const outputFile = path.join(outputDirectory, 'LLLTS.bundle.cjs');

await ensureFile(entryPoint);
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

await build({
	entryPoints: [entryPoint],
	outfile: outputFile,
	bundle: true,
	platform: 'node',
	target: 'node18',
	format: 'cjs',
	sourcemap: false,
	logLevel: 'info',
	packages: 'external'
});

console.log(`Built CLI bundle at ${path.relative(packageRoot, outputFile)}`);

async function ensureFile(filePath) {
	try {
		const fileStat = await stat(filePath);
		if (fileStat.isFile()) {
			return;
		}
	} catch {
		// handled below
	}
	throw new Error(`Expected compiler entry at ${filePath}. Run the TypeScript build first.`);
}
