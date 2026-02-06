
import { ProjectInitiator } from "./core/ProjectInitiator.lll"
import { ResultReporter } from "./core/ResultReporter.lll"
import { RulesEngine } from "./core/RulesEngine.lll"
import { LoadStrategy } from "./LoadStrategy"
import { Spec, Out } from "./public/decorators.js"
import { UseCaseRunner } from "./core/UseCaseRunner.lll"

type UseCaseRunnerReports = Awaited<ReturnType<UseCaseRunner["runAll"]>>["reports"]
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

		const useCaseRunner = new UseCaseRunner(loader, projectPath)
		const { diagnostics: scenarioDiagnostics, reports } = await useCaseRunner.runAll()

		const allDiagnostics = [...results, ...scenarioDiagnostics]
		// const bad = new BadExample2()
		// console.log("Bad usecase 1: ", typeof bad)

		const reporter = new ResultReporter(projectPath)
		if (verbose) {
			this.printUseCaseSummary(reports)
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

	@Spec("Logs use case and scenario details when --verbose is provided.")
	private static printUseCaseSummary(reports: UseCaseRunnerReports) {
		console.log("\n🧪 Use Case Execution Details")
		if (reports.length === 0) {
			console.log("  (no use cases were executed)")
			return
		}

		for (const report of reports) {
			const label = report.className
			console.log(`\n📘 Use case ${label}`)
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
		console.log()
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
