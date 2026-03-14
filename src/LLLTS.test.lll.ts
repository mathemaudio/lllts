import { LLLTS } from "./LLLTS.lll.js";
import { ClientTunnelRunner } from "./core/ClientTunnelRunner.lll.js";
import { RulesEngine } from "./core/rulesEngine/RulesEngine.lll.js";
import { TestRunner } from "./core/testing/TestRunner.lll.js";
import { AssertFn, Out, Scenario, Spec } from "./public/lll.lll.js";
import { LlltsServer } from "./server/LlltsServer.lll.js";
import type { RuleCode } from "./core/rulesEngine/RuleCode.js";

@Spec("End-to-end scenarios for the LLLTS CLI.")
export class LLLTSTest {
	testType = "unit"

	@Spec("Returns a stable compile argument set used by CLI scenarios in this suite.")
	@Out("args", "string[]")
	private static baseCompileArgs() {
		return ["--project", "./tsconfig.json", "--entry", "src/LLLTS.lll.ts"]
	}

	@Spec("Installs compile-mode stubs and restores prototypes after the callback.")
	@Out("result", "void")
	private static async withCompileStubs(
		input: {
			hasBehavioralTests: boolean
			ruleDiagnostics?: Array<{ severity: "error" | "warning" | "notice"; file: string; message: string; ruleCode: RuleCode; line?: number }>
			tunnelRunner?: (runInput: { url: string; headed: boolean; timeoutMs: number }) => Promise<{
				status: "passed" | "failed" | "timeout" | "runtime_error"
				reportText?: string
				reportJson?: unknown
				message?: string
			}>
		},
		callback: () => Promise<void>
	) {
		const originalRulesRunAll = RulesEngine.prototype.runAll
		const originalInventory = TestRunner.prototype.summarizeInventory
		const originalRunAll = TestRunner.prototype.runAll
		const originalTunnelRun = ClientTunnelRunner.prototype.run

		RulesEngine.prototype.runAll = function stubRulesRunAll() {
			return input.ruleDiagnostics ?? []
		}
		TestRunner.prototype.summarizeInventory = function stubInventory() {
			return {
				hasBehavioralTests: input.hasBehavioralTests,
				behavioralTests: input.hasBehavioralTests
					? [{ className: "BehavioralSuiteTest", filePath: "src/BehavioralSuite.test.lll.ts", line: 7 }]
					: []
			}
		}
		TestRunner.prototype.runAll = async function stubRunAll() {
			return { diagnostics: [], reports: [] }
		}
		ClientTunnelRunner.prototype.run = async function stubTunnelRun(
			runInput: { url: string; headed: boolean; timeoutMs: number }
		) {
			if (!input.tunnelRunner) {
				throw new Error("Unexpected tunnel runner invocation in this test")
			}
			return await input.tunnelRunner(runInput)
		}

		try {
			await callback()
		} finally {
			RulesEngine.prototype.runAll = originalRulesRunAll
			TestRunner.prototype.summarizeInventory = originalInventory
			TestRunner.prototype.runAll = originalRunAll
			ClientTunnelRunner.prototype.run = originalTunnelRun
		}
	}

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

	@Scenario("Behavioral inventory without --clientTunnel returns compile failure")
	@Out("result", "void")
	static async behavioralTestsRequireClientTunnel(input: object = {}, assert: AssertFn) {
		let tunnelInvoked = false
		await this.withCompileStubs(
			{
				hasBehavioralTests: true,
				tunnelRunner: async () => {
					tunnelInvoked = true
					return { status: "passed", reportText: "All client behavioral tests passed" }
				}
			},
			async () => {
				const result = await LLLTS.main(this.baseCompileArgs())
				assert(result.mode === "compile", "Compile mode should run for compiler args")
				assert(result.exitCode === 1, "Behavioral tests without client tunnel should fail compile mode")
			}
		)
		assert(!tunnelInvoked, "Client tunnel runner should not execute when --clientTunnel is absent")
	}

	@Scenario("Invalid --clientTunnelTimeoutMs returns compile failure")
	static async invalidClientTunnelTimeout(input: object = {}, assert: AssertFn) {
		const result = await LLLTS.main([...this.baseCompileArgs(), "--clientTunnelTimeoutMs", "0"])
		assert(result.mode === "compile", "Invalid timeout should still return compile result mode")
		assert(result.exitCode === 1, "Invalid timeout should return non-zero compile exit code")
	}

	@Scenario("Coverage debt warning keeps compile successful and prints success footer")
	static async coverageDebtWarningKeepsSuccess(input: object = {}, assert: AssertFn) {
		const originalLog = console.log
		const logLines: string[] = []
		console.log = (...args: unknown[]) => {
			logLines.push(args.map(arg => String(arg)).join(" "))
		}

		try {
			await this.withCompileStubs(
				{
					hasBehavioralTests: false,
					ruleDiagnostics: [{
						severity: "warning",
						file: "project",
						message: "test coverage debt 75%: 85/100 primary classes are covered with scenario tests (85% coverage, 15% uncovered; project has 150 source files). ALERT: coverage is close to the failure threshold; add tests immediately.",
						ruleCode: "test-coverage"
					}]
				},
				async () => {
					const result = await LLLTS.main(this.baseCompileArgs())
					assert(result.mode === "compile", "Compile mode should run for compiler args")
					assert(result.exitCode === 0, "Warning-level coverage debt should not fail compile")
				}
			)
		} finally {
			console.log = originalLog
		}

		assert(
			logLines.some(line => line.includes("Test coverage debt 75%")),
			"Coverage warning output should include linear debt message"
		)
		assert(
			logLines.some(line => line.includes("No issues found")),
			"Warning-only run should keep success footer"
		)
	}

	@Scenario("Coverage debt error fails compile and suppresses success footer")
	static async coverageDebtErrorFailsCompile(input: object = {}, assert: AssertFn) {
		const originalLog = console.log
		const logLines: string[] = []
		console.log = (...args: unknown[]) => {
			logLines.push(args.map(arg => String(arg)).join(" "))
		}

		try {
			await this.withCompileStubs(
				{
					hasBehavioralTests: false,
					ruleDiagnostics: [{
						severity: "error",
						file: "project",
						message: "test coverage debt 125%: 75/100 primary classes are covered with scenario tests (75% coverage, 25% uncovered; project has 150 source files). Error: uncovered classes reached the failure threshold (20% or more).",
						ruleCode: "test-coverage"
					}]
				},
				async () => {
					const result = await LLLTS.main(this.baseCompileArgs())
					assert(result.mode === "compile", "Compile mode should run for compiler args")
					assert(result.exitCode === 1, "Error-level coverage debt should fail compile")
				}
			)
		} finally {
			console.log = originalLog
		}

		assert(
			logLines.some(line => line.includes("Test coverage debt 125%")),
			"Coverage error output should include linear debt message"
		)
		assert(
			!logLines.some(line => line.includes("No issues found")),
			"Error run should not print success footer"
		)
	}

	@Scenario("--noTests skips test execution/reporting and ignores test-only failures")
	@Out("result", "void")
	static async noTestsSkipsTestExecutionAndCoverageDebtErrors(input: object = {}, assert: AssertFn) {
		const originalRulesRunAll = RulesEngine.prototype.runAll
		const originalInventory = TestRunner.prototype.summarizeInventory
		const originalRunAll = TestRunner.prototype.runAll
		const originalTunnelRun = ClientTunnelRunner.prototype.run
		const originalLog = console.log
		const logLines: string[] = []
		let summarizeInventoryCalled = false
		let runAllTestsCalled = false
		let tunnelRunCalled = false
		const observedSkipSettings: Array<{ skipTestRules?: boolean; skipTestCoverageDebt?: boolean }> = []
		console.log = (...args: unknown[]) => {
			logLines.push(args.map(arg => String(arg)).join(" "))
		}

		RulesEngine.prototype.runAll = function stubRulesRunAll(options: { skipTestRules?: boolean; skipTestCoverageDebt?: boolean } = {}) {
			observedSkipSettings.push(options)
			if (options.skipTestCoverageDebt === true) {
				return []
			}
			return [{
				severity: "error",
				file: "project",
				message: "test coverage debt 125%: synthetic error",
				ruleCode: "test-coverage"
			}]
		}
		TestRunner.prototype.summarizeInventory = function stubInventory() {
			summarizeInventoryCalled = true
			return {
				hasBehavioralTests: true,
				behavioralTests: [{ className: "BehavioralSuiteTest", filePath: "src/BehavioralSuite.test.lll.ts", line: 7 }]
			}
		}
		TestRunner.prototype.runAll = async function stubRunAll() {
			runAllTestsCalled = true
			return { diagnostics: [], reports: [] }
		}
		ClientTunnelRunner.prototype.run = async function stubTunnelRun() {
			tunnelRunCalled = true
			return { status: "passed", reportText: "All client behavioral tests passed" }
		}

		try {
			const resultWithoutNoTests = await LLLTS.main(this.baseCompileArgs())
			assert(resultWithoutNoTests.mode === "compile", "Compile mode should run without --noTests")
			assert(resultWithoutNoTests.exitCode === 1, "Without --noTests, error-level coverage debt should fail compile")

			const resultWithNoTests = await LLLTS.main([
				...this.baseCompileArgs(),
				"--noTests",
				"--verbose",
				"--clientTunnel", "http://localhost:3000"
			])
			assert(resultWithNoTests.mode === "compile", "Compile mode should run with --noTests")
			assert(resultWithNoTests.exitCode === 0, "--noTests should ignore synthetic test-coverage failure")
		} finally {
			RulesEngine.prototype.runAll = originalRulesRunAll
			TestRunner.prototype.summarizeInventory = originalInventory
			TestRunner.prototype.runAll = originalRunAll
			ClientTunnelRunner.prototype.run = originalTunnelRun
			console.log = originalLog
		}

		assert(observedSkipSettings.length >= 2, "Rules engine should be invoked for both compile runs")
		assert(observedSkipSettings[0].skipTestCoverageDebt !== true, "Default run should not skip coverage debt")
		assert(observedSkipSettings[1].skipTestCoverageDebt === true, "--noTests run should skip coverage debt")
		assert(observedSkipSettings[1].skipTestRules === true, "--noTests run should skip test rules")
		assert(summarizeInventoryCalled, "Default run should still summarize inventory")
		assert(runAllTestsCalled, "Default run should still execute tests")
		assert(!tunnelRunCalled, "Synthetic coverage error in default run should block tunnel; --noTests should skip tunnel path")
		assert(
			!logLines.some(line => line.includes("Test Execution Details")),
			"--noTests should suppress verbose test execution section"
		)
		assert(
			!logLines.some(line => line.includes("Client tunnel behavioral tests")),
			"--noTests should not print client tunnel test status"
		)
	}

	@Scenario("Behavioral tunnel pass returns compile success without full report by default")
	static async behavioralTunnelPass(input: object = {}, assert: AssertFn) {
		const originalLog = console.log
		const logLines: string[] = []
		console.log = (...args: unknown[]) => {
			logLines.push(args.map(arg => String(arg)).join(" "))
		}

		try {
			await this.withCompileStubs(
				{
					hasBehavioralTests: true,
					tunnelRunner: async () => ({
						status: "passed",
						reportText: "## src/BehavioralSuite.test.lll.ts\n- one: passed\n\nAll client behavioral tests passed"
					})
				},
				async () => {
					const result = await LLLTS.main([...this.baseCompileArgs(), "--clientTunnel", "http://localhost:3000"])
					assert(result.mode === "compile", "Compile mode should run for tunnel args")
					assert(result.exitCode === 0, "Passing tunnel run should keep compile successful")
				}
			)
		} finally {
			console.log = originalLog
		}

		assert(
			logLines.some(line => line.includes("Client tunnel behavioral tests passed")),
			"Passing tunnel run should print summary line"
		)
		assert(
			!logLines.some(line => line.includes("All client behavioral tests passed")),
			"Passing tunnel run should not print full report when --verbose is missing"
		)
	}

	@Scenario("Behavioral tunnel is skipped when local diagnostics already fail compile")
	@Out("result", "void")
	static async behavioralTunnelSkippedOnLocalErrors(input: object = {}, assert: AssertFn) {
		let tunnelInvoked = false
		await this.withCompileStubs(
			{
				hasBehavioralTests: true,
				ruleDiagnostics: [{ severity: "error", file: "src/Start.lll.ts", message: "Missing @Spec on method", ruleCode: "missing-spec-method" }],
				tunnelRunner: async () => {
					tunnelInvoked = true
					return { status: "passed", reportText: "All client behavioral tests passed" }
				}
			},
			async () => {
				const result = await LLLTS.main([...this.baseCompileArgs(), "--clientTunnel", "http://localhost:3000"])
				assert(result.mode === "compile", "Compile mode should run for tunnel args")
				assert(result.exitCode === 1, "Existing compile errors should keep compile mode failing")
			}
		)
		assert(!tunnelInvoked, "Client tunnel runner should not execute when compile already has local errors")
	}

	@Scenario("Behavioral tunnel failure prints full report and fails compile")
	static async behavioralTunnelFailure(input: object = {}, assert: AssertFn) {
		const originalLog = console.log
		const logLines: string[] = []
		console.log = (...args: unknown[]) => {
			logLines.push(args.map(arg => String(arg)).join(" "))
		}

		try {
			await this.withCompileStubs(
				{
					hasBehavioralTests: true,
					tunnelRunner: async () => ({
						status: "failed",
						reportText: "## src/BehavioralSuite.test.lll.ts\n⛔️ Scenario A: failed: boom\n\nsome failed"
					})
				},
				async () => {
					const result = await LLLTS.main([...this.baseCompileArgs(), "--clientTunnel", "http://localhost:3000"])
					assert(result.mode === "compile", "Compile mode should run for tunnel args")
					assert(result.exitCode === 1, "Failing tunnel run should fail compile mode")
				}
			)
		} finally {
			console.log = originalLog
		}

		assert(
			logLines.some(line => line.includes("some failed")),
			"Failing tunnel run should print the full terminal report text"
		)
	}

	@Scenario("Behavioral tunnel failure does not print duplicate test-failure diagnostic block")
	static async behavioralTunnelFailureHasNoDuplicateDiagnostic(input: object = {}, assert: AssertFn) {
		const originalLog = console.log
		const originalError = console.error
		const logLines: string[] = []
		const errorLines: string[] = []
		console.log = (...args: unknown[]) => {
			logLines.push(args.map(arg => String(arg)).join(" "))
		}
		console.error = (...args: unknown[]) => {
			errorLines.push(args.map(arg => String(arg)).join(" "))
		}

		try {
			await this.withCompileStubs(
				{
					hasBehavioralTests: true,
					tunnelRunner: async () => ({
						status: "failed",
						reportText: "## src/BehavioralSuite.test.lll.ts\n⛔️ Scenario A: failed: boom\n\nsome failed"
					})
				},
				async () => {
					const result = await LLLTS.main([...this.baseCompileArgs(), "--clientTunnel", "http://localhost:3000"])
					assert(result.mode === "compile", "Compile mode should run for tunnel args")
					assert(result.exitCode === 1, "Failing tunnel run should still fail compile mode")
				}
			)
		} finally {
			console.log = originalLog
			console.error = originalError
		}

		assert(
			!logLines.some(line => line.includes("ERROR: Test scenario failed")),
			"Behavioral tunnel failure should not print duplicate grouped test-failure diagnostic"
		)
		assert(
			!logLines.some(line => line.includes("No issues found")),
			"Behavioral tunnel failure should not print a success footer"
		)
		assert(
			errorLines.some(line => line.includes("Behavioral tests failed")),
			"Behavioral tunnel failure should print a clear final failure line"
		)
	}

	@Scenario("Verbose tunnel-only run does not print no-tests-executed placeholder")
	static async verboseBehavioralOnlyRunSkipsNoTestsPlaceholder(input: object = {}, assert: AssertFn) {
		const originalLog = console.log
		const logLines: string[] = []
		console.log = (...args: unknown[]) => {
			logLines.push(args.map(arg => String(arg)).join(" "))
		}

		try {
			await this.withCompileStubs(
				{
					hasBehavioralTests: true,
					tunnelRunner: async () => ({
						status: "passed",
						reportText: "## src/BehavioralSuite.test.lll.ts\n- one: passed\n\nAll client behavioral tests passed"
					})
				},
				async () => {
					const result = await LLLTS.main([
						...this.baseCompileArgs(),
						"--clientTunnel", "http://localhost:3000",
						"--verbose"
					])
					assert(result.mode === "compile", "Compile mode should run for tunnel args")
					assert(result.exitCode === 0, "Passing tunnel run should keep compile successful")
				}
			)
		} finally {
			console.log = originalLog
		}

		assert(
			!logLines.some(line => line.includes("(no tests were executed)")),
			"Verbose tunnel-only runs should not print a no-tests-executed placeholder"
		)
	}

	@Scenario("--clientTunnelHeaded and --clientTunnelTimeoutMs are forwarded to tunnel runner")
	@Out("result", "void")
	static async tunnelFlagsAreForwarded(input: object = {}, assert: AssertFn) {
		const calls: Array<{ url: string; headed: boolean; timeoutMs: number }> = []
		await this.withCompileStubs(
			{
				hasBehavioralTests: true,
				tunnelRunner: async (runInput) => {
					calls.push(runInput)
					return { status: "passed", reportText: "All client behavioral tests passed" }
				}
			},
			async () => {
				const result = await LLLTS.main([
					...this.baseCompileArgs(),
					"--clientTunnel", "http://localhost:3000",
					"--clientTunnelHeaded",
					"--clientTunnelTimeoutMs", "1234"
				])
				assert(result.mode === "compile", "Compile mode should run for tunnel args")
				assert(result.exitCode === 0, "Passing tunnel run should keep compile successful")
			}
		)

		assert(calls.length === 1, "Tunnel runner should run once when behavioral tests are present")
		assert(calls[0].url === "http://localhost:3000", "Tunnel URL should be forwarded into tunnel runner")
		assert(calls[0].headed === true, "Headed flag should be forwarded into tunnel runner")
		assert(calls[0].timeoutMs === 1234, "Timeout flag should be forwarded into tunnel runner")
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
