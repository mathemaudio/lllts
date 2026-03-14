
import { ProjectInitiator } from "./core/ProjectInitiator.lll"
import { ResultReporter } from "./core/ResultReporter.lll"
import { RulesEngine } from "./core/rulesEngine/RulesEngine.lll"
import { BaseRule } from "./core/BaseRule.lll"
import { ClientTunnelRunner } from "./core/ClientTunnelRunner.lll"
import { LoadStrategy } from "./LoadStrategy"
import { Out } from "./public/lll.lll"
import { Spec } from "./public/lll.lll"
import { TestRunner } from "./core/testing/TestRunner.lll"
import { LlltsServer } from "./server/LlltsServer.lll"
import type { ClientTunnelConfig } from "./ClientTunnelConfig"
import type { MainResult } from "./MainResult"
import type { ServerModeConfig } from "./ServerModeConfig"
import type { ClientTunnelRunResult } from "./core/ClientTunnelRunResult"
import type { TestInventorySummary } from "./core/testing/TestInventorySummary"
import type { TestReport } from "./core/testing/TestReport"
// import { BadExample2 } from "./examples/intentionallyBadExampleTests/badExample2"

@Spec("CLI entry that loads a LLLTS project, applies rules, and reports diagnostics.")
export class LLLTS {
	@Spec("Reads CLI args and runs LLLTS checks on the target project.")

	@Out("result", "{ mode: 'compile', exitCode: number } | { mode: 'server', port: number }")
	public static async main(args: string[]): Promise<MainResult> {
		const serverModeResult = await this.tryRunServerMode(args)
		if (serverModeResult !== null) {
			return serverModeResult
		}

		const projectPath = this.getArg(args, "--project")
		const entryFile = this.getArg(args, "--entry")
		const loadStrategy = this.getOptionalArg(args, "--load-strategy", "from_imports") as LoadStrategy
		const verbose = this.hasFlag(args, "--verbose")
		const noTests = this.hasFlag(args, "--noTests")
		const clientTunnelConfigResult = this.parseClientTunnelConfig(args)
		if (!clientTunnelConfigResult.valid) {
			console.error(`\n❌ ${clientTunnelConfigResult.error}`)
			return { mode: "compile", exitCode: 1 }
		}
		const clientTunnelConfig = clientTunnelConfigResult.config



		console.log(`LLLTS Compiler v0.1.2`)
		// console.log(`Project: ${projectPath}`)
		console.log(`Entry: ${entryFile}`)

		let loader: ProjectInitiator
		try {
			loader = new ProjectInitiator(projectPath, loadStrategy, entryFile)
		} catch (error) {
			console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`)
			return { mode: "compile", exitCode: 1 }
		}

		const ruleEngine = new RulesEngine(loader)
		const results = ruleEngine.runAll({
			skipTestRules: noTests,
			skipTestCoverageDebt: noTests
		})

		let inventory: TestInventorySummary = {
			hasBehavioralTests: false,
			behavioralTests: []
		}
		let scenarioDiagnostics: import("./core/DiagnosticObject").DiagnosticObject[] = []
		let reports: TestReport[] = []
		if (!noTests) {
			const testRunner = new TestRunner(loader, projectPath)
			inventory = testRunner.summarizeInventory()
			const testRunResult = await testRunner.runAll()
			scenarioDiagnostics = testRunResult.diagnostics
			reports = testRunResult.reports
		}

		const allDiagnostics = [...results, ...scenarioDiagnostics]
		if (!noTests && inventory.hasBehavioralTests && clientTunnelConfig.url === null) {
			allDiagnostics.push(this.createMissingClientTunnelDiagnostic(inventory))
		}

		let clientTunnelResult: ClientTunnelRunResult | null = null
		const diagnosticsFailedBeforeClientTunnel = allDiagnostics.some(r => r.severity === "error")
		if (!noTests && !diagnosticsFailedBeforeClientTunnel && inventory.hasBehavioralTests && clientTunnelConfig.url !== null) {
			const runner = new ClientTunnelRunner()
			clientTunnelResult = await runner.run({
				url: clientTunnelConfig.url,
				headed: clientTunnelConfig.headed,
				timeoutMs: clientTunnelConfig.timeoutMs
			})
			allDiagnostics.push(...this.mapClientTunnelResultToDiagnostics(clientTunnelResult, inventory))
			this.printClientTunnelOutput(clientTunnelResult, verbose)
		}
		// const bad = new BadExample2()
		// console.log("Bad test 1: ", typeof bad)

		const reporter = new ResultReporter(projectPath)
		const tunnelFailed = clientTunnelResult?.status === "failed"
		if (verbose && !noTests) {
			this.printTestSummary(reports, inventory.hasBehavioralTests)
		}
		reporter.print(allDiagnostics, { suppressSuccessMessage: tunnelFailed })
		if (tunnelFailed) {
			console.error("\n❌ Behavioral tests failed.")
		}

		const diagnosticsFailed = allDiagnostics.some(r => r.severity === "error")
		return { mode: "compile", exitCode: diagnosticsFailed || tunnelFailed ? 1 : 0 }
	}

	@Spec("Runs server mode when '--server' is present; returns null for compile mode.")
	@Out("result", "MainResult | null")
	private static async tryRunServerMode(args: string[]): Promise<MainResult | null> {
		const serverFlagIndex = args.indexOf("--server")
		if (serverFlagIndex < 0) {
			return null
		}

		const action = args[serverFlagIndex + 1]
		if (action !== "start") {
			console.error(`\n❌ Unsupported server action: ${action ?? "(missing)"}. Use '--server start'.`)
			return { mode: "compile", exitCode: 1 }
		}

		const portResult = this.parseServerPort(args)
		if (!portResult.valid) {
			console.error(`\n❌ ${portResult.error}`)
			return { mode: "compile", exitCode: 1 }
		}
		const configResult = this.parseServerConfig(args)
		if (!configResult.valid) {
			console.error(`\n❌ ${configResult.error}`)
			return { mode: "compile", exitCode: 1 }
		}

		const server = new LlltsServer()
		const port = await server.start(portResult.port, configResult.config)
		console.log(`LLLTS server listening on http://localhost:${port}`)
		return { mode: "server", port }
	}

	@Spec("Parses and validates '--port' for server mode.")
	@Out("portResult", "{ valid: true; port: number } | { valid: false; error: string }")
	private static parseServerPort(args: string[]): { valid: true; port: number } | { valid: false; error: string } {
		const defaultPort = 54300
		const i = args.indexOf("--port")
		if (i < 0) {
			return { valid: true, port: defaultPort }
		}
		if (i + 1 >= args.length) {
			return { valid: false, error: "Missing value for --port." }
		}

		const rawPort = args[i + 1].trim()
		if (!/^\d+$/.test(rawPort)) {
			return { valid: false, error: `Invalid --port value '${rawPort}'. Expected integer 1..65535.` }
		}

		const port = Number(rawPort)
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			return { valid: false, error: `Invalid --port value '${rawPort}'. Expected integer 1..65535.` }
		}

		return { valid: true, port }
	}

	@Spec("Parses required server runtime config flags.")
	@Out("configResult", "{ valid: true; config: ServerModeConfig } | { valid: false; error: string }")
	private static parseServerConfig(args: string[]): { valid: true; config: ServerModeConfig } | { valid: false; error: string } {
		const projectPathResult = this.parseRequiredServerArg(args, "--projectPath")
		if (!projectPathResult.valid) {
			return projectPathResult
		}
		const projectClientLinkResult = this.parseRequiredServerArg(args, "--projectClientLink")
		if (!projectClientLinkResult.valid) {
			return projectClientLinkResult
		}
		return {
			valid: true,
			config: {
				projectPath: projectPathResult.value,
				projectClientLink: projectClientLinkResult.value
			}
		}
	}

	@Spec("Parses one required server argument and validates that it has a non-empty value.")
	@Out("argumentResult", "{ valid: true; value: string } | { valid: false; error: string }")
	private static parseRequiredServerArg(args: string[], flag: string): { valid: true; value: string } | { valid: false; error: string } {
		const i = args.indexOf(flag)
		if (i < 0) {
			return { valid: false, error: `Missing required server argument: ${flag}.` }
		}
		if (i + 1 >= args.length) {
			return { valid: false, error: `Missing value for ${flag}.` }
		}
		const value = args[i + 1].trim()
		if (value.length === 0) {
			return { valid: false, error: `Missing value for ${flag}.` }
		}
		return { valid: true, value }
	}

	@Spec("Parses optional client tunnel flags used for behavioral browser execution.")
	@Out("configResult", "{ valid: true; config: ClientTunnelConfig } | { valid: false; error: string }")
	private static parseClientTunnelConfig(args: string[]): { valid: true; config: ClientTunnelConfig } | { valid: false; error: string } {
		const urlResult = this.parseOptionalArgValue(args, "--clientTunnel")
		if (!urlResult.valid) {
			return urlResult
		}

		const timeoutResult = this.parseOptionalPositiveIntegerArg(args, "--clientTunnelTimeoutMs", 60000)
		if (!timeoutResult.valid) {
			return timeoutResult
		}

		return {
			valid: true,
			config: {
				url: urlResult.value,
				headed: this.hasFlag(args, "--clientTunnelHeaded"),
				timeoutMs: timeoutResult.value
			}
		}
	}

	@Spec("Parses an optional flag value and validates non-empty argument text.")
	@Out("valueResult", "{ valid: true; value: string | null } | { valid: false; error: string }")
	private static parseOptionalArgValue(args: string[], flag: string): { valid: true; value: string | null } | { valid: false; error: string } {
		const i = args.indexOf(flag)
		if (i < 0) {
			return { valid: true, value: null }
		}
		if (i + 1 >= args.length || args[i + 1].startsWith("--")) {
			return { valid: false, error: `Missing value for ${flag}.` }
		}
		const value = args[i + 1].trim()
		if (value.length === 0) {
			return { valid: false, error: `Missing value for ${flag}.` }
		}
		return { valid: true, value }
	}

	@Spec("Parses an optional positive integer flag with fallback default.")
	@Out("valueResult", "{ valid: true; value: number } | { valid: false; error: string }")
	private static parseOptionalPositiveIntegerArg(
		args: string[],
		flag: string,
		defaultValue: number
	): { valid: true; value: number } | { valid: false; error: string } {
		const i = args.indexOf(flag)
		if (i < 0) {
			return { valid: true, value: defaultValue }
		}
		if (i + 1 >= args.length || args[i + 1].startsWith("--")) {
			return { valid: false, error: `Missing value for ${flag}.` }
		}

		const rawValue = args[i + 1].trim()
		if (!/^\d+$/.test(rawValue)) {
			return { valid: false, error: `Invalid ${flag} value '${rawValue}'. Expected positive integer.` }
		}

		const parsed = Number(rawValue)
		if (!Number.isInteger(parsed) || parsed <= 0) {
			return { valid: false, error: `Invalid ${flag} value '${rawValue}'. Expected positive integer.` }
		}
		return { valid: true, value: parsed }
	}

	@Spec("Builds compile diagnostics when behavioral tests require a client tunnel URL.")
	@Out("diagnostic", "import('./core/DiagnosticObject').DiagnosticObject")
	private static createMissingClientTunnelDiagnostic(inventory: TestInventorySummary) {
		const first = inventory.behavioralTests[0]
		if (!first) {
			return BaseRule.createError(
				"(behavioral-tests)",
				"Behavioral tests were discovered, but '--clientTunnel <url>' was not provided.",
				"test-failure"
			)
		}
		const details = inventory.behavioralTests
			.map(test => `- ${test.filePath}:${test.line} (${test.className})`)
			.join("\n")
		const messageLines = [
			"Behavioral tests were discovered, but '--clientTunnel <url>' was not provided.",
			"Provide a reachable overlay page URL and rerun compile mode.",
			"Detected behavioral tests:",
			details
		]
		return BaseRule.createError(first.filePath, messageLines.join("\n"), "test-failure", first.line)
	}

	@Spec("Maps client tunnel results to compile diagnostics.")
	@Out("diagnostics", "import('./core/DiagnosticObject').DiagnosticObject[]")
	private static mapClientTunnelResultToDiagnostics(result: ClientTunnelRunResult, inventory: TestInventorySummary) {
		if (result.status === "passed") {
			return []
		}

		if (result.status === "failed") {
			return []
		}

		const anchor = inventory.behavioralTests[0]
		const file = anchor?.filePath ?? "(behavioral-tests)"
		const line = anchor?.line

		if (result.status === "timeout") {
			return [
				BaseRule.createError(
					file,
					`Client tunnel timed out while waiting for FIXED_llltsLastRunReport. ${result.message ?? ""}`.trim(),
					"test-failure",
					line
				)
			]
		}

		return [
			BaseRule.createError(
				file,
				`Client tunnel runtime error. ${result.message ?? ""}`.trim(),
				"test-failure",
				line
			)
		]
	}

	@Spec("Retrieves a required CLI argument by flag or throws error.")

	@Out("argument", "string")
	private static getArg(args: string[], flag: string) {
		const i = args.indexOf(flag)
		if (i >= 0 && i + 1 < args.length) return args[i + 1]
		throw new Error(`Missing argument: ${flag}`)
	}

	@Spec("Retrieves an optional CLI argument by flag or returns default value.")

	@Out("argument", "string")
	private static getOptionalArg(args: string[], flag: string, defaultValue: string) {
		const i = args.indexOf(flag)
		if (i >= 0 && i + 1 < args.length) return args[i + 1]
		return defaultValue
	}

	@Spec("Checks if the CLI args include the flag (no value expected).")

	@Out("present", "boolean")
	private static hasFlag(args: string[], flag: string) {
		return args.includes(flag)
	}

	@Spec("Logs test and scenario details when --verbose is provided.")
	private static printTestSummary(reports: TestReport[], hasBehavioralTests: boolean) {
		if (reports.length === 0) {
			if (hasBehavioralTests) {
				return
			}
			console.log("\n🧪 Test Execution Details")
			console.log("  (no tests were executed)")
			return
		}

		console.log("\n🧪 Test Execution Details")
		for (const report of reports) {
			const label = report.className
			console.log(`\n📘 Test ${label}`)
			console.log(`   ${report.filePath}:${report.line}`)
			if (report.scenarios.length === 0) {
				console.log("   (no scenarios defined)")
				continue
			}

			for (const scenario of report.scenarios) {
				const icon = scenario.status === "passed" ? "✅" : "❌"
				console.log(`   ${icon} ${scenario.name}`)
			}
		}
	}

	@Spec("Prints tunnel summary plus full report based on status and verbosity.")
	private static printClientTunnelOutput(result: ClientTunnelRunResult, verbose: boolean) {
		if (result.status === "passed") {
			console.log("\n🌐 Client tunnel behavioral tests passed.")
			if (verbose && typeof result.reportText === "string" && result.reportText.length > 0) {
				console.log("\n📋 Client tunnel report")
				console.log(result.reportText)
			}
			return
		}

		if (result.status === "failed") {
			console.log("\n🌐 Client tunnel behavioral tests failed.")
			if (typeof result.reportText === "string" && result.reportText.length > 0) {
				console.log("\n📋 Client tunnel report")
				console.log(result.reportText)
			}
			return
		}

		if (result.status === "timeout") {
			console.error(`\n❌ Client tunnel timed out: ${result.message ?? "No additional details."}`)
			return
		}

		console.error(`\n❌ Client tunnel runtime error: ${result.message ?? "No additional details."}`)
	}
}

// CLI entry point
if (require.main === module) {
	LLLTS.main(process.argv.slice(2))
		.then(result => {
			if (result.mode === "compile") {
				process.exit(result.exitCode)
			}
		})
		.catch(error => {
			console.error(error instanceof Error ? error.stack ?? error.message : String(error))
			process.exit(1)
		})
}
