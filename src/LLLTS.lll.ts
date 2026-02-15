
import { ProjectInitiator } from "./core/ProjectInitiator.lll"
import { ResultReporter } from "./core/ResultReporter.lll"
import { RulesEngine } from "./core/RulesEngine.lll"
import { LoadStrategy } from "./LoadStrategy"
import { Out } from "./public/lll.lll"
import { Spec } from "./public/lll.lll"
import { TestRunner } from "./core/TestRunner.lll"
import { LlltsServer } from "./server/LlltsServer.lll"

type TestRunnerReports = Awaited<ReturnType<TestRunner["runAll"]>>["reports"]
type MainResult = { mode: "compile"; exitCode: number } | { mode: "server"; port: number }
type ServerModeConfig = { projectPath: string; projectClientLink: string }
// import { BadExample2 } from "./examples/intentionallyBadExampleTests/badExample2"

@Spec("CLI entry that loads a LLLTS project, applies rules, and reports diagnostics.")
export class LLLTS {
	@Spec("Reads CLI args and runs LLLTS checks on the target project.")

	@Out("result", "{ mode: 'compile', exitCode: number } | { mode: 'server', port: number }")
	public static async main(args: string[]): Promise<MainResult> {
		const serverModeResult = await this.tryRunServerMode(args)
		if (serverModeResult) {
			return serverModeResult
		}

		const projectPath = this.getArg(args, "--project")
		const entryFile = this.getArg(args, "--entry")
		const loadStrategy = this.getOptionalArg(args, "--load-strategy", "from_imports") as LoadStrategy
		const verbose = this.hasFlag(args, "--verbose")



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
		const results = ruleEngine.runAll()

		const testRunner = new TestRunner(loader, projectPath)
		const { diagnostics: scenarioDiagnostics, reports } = await testRunner.runAll()

		const allDiagnostics = [...results, ...scenarioDiagnostics]
		// const bad = new BadExample2()
		// console.log("Bad test 1: ", typeof bad)

		const reporter = new ResultReporter(projectPath)
		if (verbose) {
			this.printTestSummary(reports)
		}
		reporter.print(allDiagnostics)

		return { mode: "compile", exitCode: allDiagnostics.some(r => r.severity === "error") ? 1 : 0 }
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
	private static printTestSummary(reports: TestRunnerReports) {
		console.log("\n🧪 Test Execution Details")
		if (reports.length === 0) {
			console.log("  (no tests were executed)")
			return
		}

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
