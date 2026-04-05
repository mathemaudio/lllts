import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { AssertFn, Scenario, Spec } from "../public/lll.lll.js"
import "./ProjectInitiator.lll"
import { ProjectInitiator } from "./ProjectInitiator.lll"

@Spec("Verifies project loading strategies.")
export class ProjectInitiatorTest {
	testType = "unit"

	@Scenario("Load project files")
	static async loadFiles(input = {}, assert: AssertFn) {
		const loader = new ProjectInitiator("./tsconfig.json", "from_imports", "src/examples/MathObject.lll.ts")
		const files = loader.getFiles()
		assert(files.length > 0, "Should load at least lll file")
	}

	@Scenario("Follow re-export declarations in from_imports mode")
	static async followReExportDeclarations(input = {}, assert: AssertFn) {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-reexport-"))

		try {
			const srcDir = path.join(tempRoot, "src")
			fs.mkdirSync(srcDir, { recursive: true })

			fs.writeFileSync(
				path.join(tempRoot, "tsconfig.json"),
				JSON.stringify({
					compilerOptions: {
						target: "ES2022",
						module: "CommonJS",
						moduleResolution: "Node",
						experimentalDecorators: true
					},
					include: ["src/**/*"]
				})
			)

			fs.writeFileSync(path.join(srcDir, "index.ts"), "export * from './api'\n")
			fs.writeFileSync(path.join(srcDir, "api.ts"), "export class Api {}\n")

			const loader = new ProjectInitiator(path.join(tempRoot, "tsconfig.json"), "from_imports", "src/index.ts")
			const loadedFiles = loader.getFiles().map(file => path.basename(file.getFilePath()))

			assert(loadedFiles.includes("index.ts"), "Expected entry barrel file to be loaded")
			assert(loadedFiles.includes("api.ts"), "Expected re-exported target file to be loaded")
		} finally {
			fs.rmSync(tempRoot, { recursive: true, force: true })
		}
	}

	@Scenario("Load both companion variants for a primary class in from_imports mode")
	static async loadBothCompanionVariants(input = {}, assert: AssertFn) {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-dual-companion-"))

		try {
			const srcDir = path.join(tempRoot, "src")
			fs.mkdirSync(srcDir, { recursive: true })

			fs.writeFileSync(
				path.join(tempRoot, "tsconfig.json"),
				JSON.stringify({
					compilerOptions: {
						target: "ES2022",
						module: "CommonJS",
						moduleResolution: "Node",
						experimentalDecorators: true
					},
					include: ["src/**/*"]
				})
			)

			fs.writeFileSync(path.join(srcDir, "Main.lll.ts"), "export class Main {}\n")
			fs.writeFileSync(path.join(srcDir, "Main.test.lll.ts"), "export class MainTest {}\n")
			fs.writeFileSync(path.join(srcDir, "Main.test2.lll.ts"), "export class MainTest2 {}\n")

			const loader = new ProjectInitiator(path.join(tempRoot, "tsconfig.json"), "from_imports", "src/Main.lll.ts")
			const loadedFiles = loader.getFiles().map(file => path.basename(file.getFilePath()))

			assert(loadedFiles.includes("Main.lll.ts"), "Expected primary file to be loaded")
			assert(loadedFiles.includes("Main.test.lll.ts"), "Expected first companion to be loaded")
			assert(loadedFiles.includes("Main.test2.lll.ts"), "Expected second companion to be loaded")
		} finally {
			fs.rmSync(tempRoot, { recursive: true, force: true })
		}
	}
}
