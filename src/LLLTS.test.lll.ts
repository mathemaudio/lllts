import { LLLTS } from "./LLLTS.lll.js";
import { AssertFn, Out, Scenario, Spec } from "./public/lll.lll.js";
import { LlltsServer } from "./server/LlltsServer.lll.js";

@Spec("End-to-end scenarios for the LLLTS CLI.")
export class LLLTSTest {
	testType = "unit"

	@Scenario("Compile MathObject example using the playground inputs")
	static async compileMathObjectExample(input: { project?: string; entry?: string; verbose?: boolean } = {}, assert: AssertFn) {
		const project = (input.project || "./tsconfig.json").trim()
		const entry = (input.entry || "src/examples/MathObject.lll.ts").trim()
		const verbose = input.verbose ?? false

		const args = ["--project", project, "--entry", entry]
		if (verbose) {
			args.push("--verbose")
		}

		const result = await LLLTS.main(args)
		assert(result.mode === "compile", "Compiler args should execute compile mode")
		assert(typeof result.exitCode === "number", "Compile mode should return an exit code")
		console.log("Playground run", { project, entry, verbose, exitCode: result.exitCode })
	}

	@Scenario("Server start with explicit valid port returns server mode")
	@Out("result", "void")
	static async serverStartMode(input: object = {}, assert: AssertFn) {
		const port = 54397
		const projectPath = "."
		const projectClientLink = "http://localhost:3000"
		const originalStart = LlltsServer.prototype.start
		LlltsServer.prototype.start = async function mockStart(inputPort: number, config: { projectPath: string; projectClientLink: string }) {
			assert(config.projectPath === projectPath, "Server mode should pass --projectPath into server config")
			assert(config.projectClientLink === projectClientLink, "Server mode should pass --projectClientLink into server config")
			return inputPort
		}

		try {
			const result = await LLLTS.main([
				"--server", "start",
				"--port", String(port),
				"--projectPath", projectPath,
				"--projectClientLink", projectClientLink
			])
			assert(result.mode === "server", "Server args should execute server mode")
			assert(result.port === port, "Server mode should return the parsed port")
		} finally {
			LlltsServer.prototype.start = originalStart
		}
	}

	@Scenario("Missing --projectPath returns compile failure result")
	static async missingServerProjectPath(input: object = {}, assert: AssertFn) {
		const result = await LLLTS.main(["--server", "start", "--port", "54300", "--projectClientLink", "http://localhost:3000"])
		assert(result.mode === "compile", "Missing --projectPath should return compile failure result")
		assert(result.exitCode === 1, "Missing --projectPath should return non-zero exit code")
	}

	@Scenario("Missing --projectClientLink returns compile failure result")
	static async missingServerProjectClientLink(input: object = {}, assert: AssertFn) {
		const result = await LLLTS.main(["--server", "start", "--port", "54300", "--projectPath", "."])
		assert(result.mode === "compile", "Missing --projectClientLink should return compile failure result")
		assert(result.exitCode === 1, "Missing --projectClientLink should return non-zero exit code")
	}

	@Scenario("Invalid server port returns compile failure result")
	static async invalidServerPort(input: object = {}, assert: AssertFn) {
		const result = await LLLTS.main(["--server", "start", "--port", "abc", "--projectPath", ".", "--projectClientLink", "http://localhost:3000"])
		assert(result.mode === "compile", "Invalid server args should return compile failure result")
		assert(result.exitCode === 1, "Invalid server args should return non-zero exit code")
	}

	@Scenario("Unsupported server action returns compile failure result")
	static async unsupportedServerAction(input: object = {}, assert: AssertFn) {
		const result = await LLLTS.main(["--server", "stop"])
		assert(result.mode === "compile", "Unsupported server action should return compile failure result")
		assert(result.exitCode === 1, "Unsupported server action should return non-zero exit code")
	}
}
