
import { DiagnosticObject } from "./DiagnosticObject"
import { RuleCode } from "./RuleCode"
import { Severity } from "./Severity"
import { Out } from "../public/lll"
import { Spec } from "../public/lll"
import * as path from "path"

@Spec("Formats and prints diagnostics to the console.")
export class ResultReporter {
	private projectRoot: string

	private static readonly RULE_DESCRIPTIONS: Record<RuleCode, string> = {
		"no-export": "Wrong number of exports. Only if it's impossible to follow LLLTS, for example, 1. you need to support old system, 2. you export decorators - only in those two cases - rename the file from .ts to .old.ts, but avoid it at all costs",
		"name-mismatch": "Export name must match filename",
		"extra-exports": "Extra exports beyond main class/type",
		"missing-spec-class": "Missing @Spec on class",
		"missing-spec-method": "Missing @Spec on method",
		"missing-desc-class": "Missing description in class @Spec",
		"missing-desc-method": "Missing description in method @Spec",
		"missing-usecase": "Companion view/scenario structure missing",
		"missing-environment": "Companion usecase must declare environment = 'api' | 'browser'",
		"bad-environment": "Companion environment must be a literal 'api' or 'browser'",
		"missing-out": "Missing @Out when returning value",
		"extra-out": "Has @Out but doesn't return value",
		"bad-out": "Invalid @Out parameters",
		"usecase-coverage": "Use-case coverage",
		"usecase-failure": "Use case scenario failed"
	}

	constructor(tsconfigPath: string) {
		this.projectRoot = path.dirname(tsconfigPath)
	}

	@Spec("Groups diagnostics by their rule code for organized reporting.")

	@Out("grouped", "Map<RuleCode, DiagnosticObject[]>")
	private groupDiagnosticsByRuleCode(results: DiagnosticObject[]) {
		const grouped = new Map<string, DiagnosticObject[]>()
		for (const diagnostic of results) {
			const ruleCode = diagnostic.ruleCode
			if (!grouped.has(ruleCode)) {
				grouped.set(ruleCode, [])
			}
			grouped.get(ruleCode)!.push(diagnostic)
		}
		return grouped
	}

	@Spec("Pretty prints results with colors in grouped format.")
	public print(results: DiagnosticObject[]) {
		if (results.length === 0) {
			console.log("✅ No issues found.")
			return
		}

		const notices = results.filter(r => r.severity === "notice")
		const issues = results.filter(r => r.severity !== "notice")

		// Print notices first (informational)
		if (notices.length) {
			this.printGrouped(notices, "notice")
		}

		// Print warnings/errors next
		if (issues.length) {
			this.printGrouped(issues)
		}

		// If only notices were present, still affirm OK status
		if (issues.length === 0) {
			console.log("\n✅ No issues found.")
		}
	}

	@Spec("Prints grouped diagnostics with optional forced severity.")
	private printGrouped(results: DiagnosticObject[], forcedSeverity?: Severity) {
		const grouped = this.groupDiagnosticsByRuleCode(results)

		for (const [ruleCode, diagnostics] of grouped) {
			const severity = forcedSeverity ?? diagnostics[0].severity
			const color = severity === "error"
				? "\x1b[31m"
				: severity === "warning"
					? "\x1b[33m"
					: severity === "notice"
						? "\x1b[36m"
						: "\x1b[37m"
			const reset = "\x1b[0m"
			const description = ResultReporter.RULE_DESCRIPTIONS[ruleCode as keyof typeof ResultReporter.RULE_DESCRIPTIONS] || ruleCode

			console.log(`\n${color}${severity.toUpperCase()}: ${description}${reset}`)

			const byFile = new Map<string, DiagnosticObject[]>()
			for (const diag of diagnostics) {
				if (!byFile.has(diag.file)) {
					byFile.set(diag.file, [])
				}
				byFile.get(diag.file)!.push(diag)
			}
			const indent = `  `
			for (const [file, fileDiags] of byFile) {
				const relativePath = path.relative(this.projectRoot, file)
				const single = fileDiags.length === 1
				if (!single) {
					console.log(`${indent}${relativePath}`)
				}
				for (const diag of fileDiags) {
					const locationPrefix = diag.line
						? single
							? `${indent}${relativePath}:${diag.line}`
							: `${indent}${indent}line ${diag.line}`
						: single
							? `${indent}${relativePath}`
							: `${indent}${indent}`
					const message = diag.message || ""
					console.log(`${locationPrefix} ${message}`)
				}
			}
		}
	}
}
