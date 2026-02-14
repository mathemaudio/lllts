
import { ProjectInitiator } from "./core/ProjectInitiator.lll"
import { ResultReporter } from "./core/ResultReporter.lll"
import { RulesEngine } from "./core/RulesEngine.lll"
import { LoadStrategy } from "./LoadStrategy"
import { Out } from "./public/lll.lll"
import { Spec } from "./public/lll.lll"
import { TestRunner } from "./core/TestRunner.lll"

type TestRunnerReports = Awaited<ReturnType<TestRunner["runAll"]>>["reports"]
// import { BadExample2 } from "./examples/intentionallyBadExampleTests/badExample2"

@Spec("CLI entry that loads a LLLTS project, applies rules, and reports diagnostics.")
export class LllTsc {
	@Spec("Reads CLI args and runs LLLTS checks on the target project.")

	@Out("exitCode", "number")
	public static async main(args: string[]) {
		const projectPath = this.getArg(args, "--project")
		const entryFile = this.getArg(args, "--entry")
		const loadStrategy = this.getOptionalArg(args, "--load-strategy", "from_imports") as LoadStrategy
		const verbose = this.hasFlag(args, "--verbose")



		console.log(`🔍 LLLTS Compiler v0.1.1`)
		console.log(`📁 Project: ${projectPath}`)
		console.log(`📄 Entry: ${entryFile}`)

		let loader: ProjectInitiator
		try {
			loader = new ProjectInitiator(projectPath, loadStrategy, entryFile)
		} catch (error) {
			console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`)
			return 1
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

		return allDiagnostics.some(r => r.severity === "error") ? 1 : 0
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
	LllTsc.main(process.argv.slice(2))
		.then(exitCode => process.exit(exitCode))
		.catch(error => {
			console.error(error instanceof Error ? error.stack ?? error.message : String(error))
			process.exit(1)
		})
}
