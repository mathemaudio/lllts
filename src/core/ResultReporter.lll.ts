
import { DiagnosticObject } from "./DiagnosticObject"
import { RuleCode } from "./rulesEngine/RuleCode"
import { Severity } from "./Severity"
import { Out } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import * as path from "path"
import { MaxFileLengthRule } from "../rules/limits/MaxFileLengthRule.lll"
import { MaxMethodLengthRule } from "../rules/limits/MaxMethodLengthRule.lll"

@Spec("Formats and prints diagnostics to the console.")
export class ResultReporter {
	private projectRoot: string

	private static readonly RULE_DESCRIPTIONS: Record<RuleCode, string> = {
		"no-export": "Wrong number of exports. Only if it's impossible to follow LLLTS, for example: 1. you need to support old system, 2. you export decorators - only in those two cases - rename the file from .ts to .old.ts, but avoid it at all costs",
		"name-mismatch": "Export name must match filename",
		"extra-exports": "Extra exports beyond main class/type",
		"extra-top-level": "Extra top-level class/type/interface declarations",
		"rogue-top-level": "Forbidden top-level declarations/statements",
		"missing-spec-class": "Missing @Spec on class",
		"missing-spec-method": "Missing @Spec on method",
		"missing-spec-type": "Missing Spec call before exported type",
		"missing-desc-class": "Missing description in class @Spec",
		"missing-desc-method": "Missing description in method @Spec",
		"missing-test": "Test companion structure missing",
		"missing-test-type": "Test must declare testType = 'unit' | 'behavioral'",
		"bad-test-type": "Test testType must be literal 'unit' or 'behavioral'",
		"test-import-boundary": "Production code cannot import test modules",
		"missing-out": "Missing @Out when returning value",
		"extra-out": "Has @Out but doesn't return value",
		"bad-out": "Invalid @Out parameters",
		"test-coverage": "Test coverage debt",
		"test-failure": "Test scenario failed",
		"file-too-long": `File allowed maximum line limit is ${MaxFileLengthRule.MAX_LINES} lines. Consider splitting into smaller modules`,
		"method-too-long": `Method body allowed maximum line limit is ${MaxMethodLengthRule.MAX_LINES} lines. Consider refactoring into smaller methods`,
		"folder-too-many-files": "Folder contains too many source files",
		"folder-too-many-folders": "Folder contains too many subfolders",
		"assignment-in-conditions": "Assignments are forbidden inside conditions",
		"no-loose-equality": "Loose equality operators are forbidden",
		"no-implicit-truthiness": "Conditions cannot rely on implicit truthiness",
		"switch-fallthrough": "Switch clauses must terminate or use an explicit fallthrough marker",
		"no-ignored-promises": "Promise-valued expression statements must be handled explicitly",
		"no-implicit-primitive-coercion": "Arithmetic operators require statically numeric operands",
		"no-any": "Explicit any is forbidden",
		"no-non-null-assertion": "Non-null assertions are forbidden"
	}

	constructor(tsconfigPath: string) {
		Spec("Initializes reporter root path from tsconfig location.")
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
			const groupedDiagnostics = grouped.get(ruleCode)
			if (groupedDiagnostics !== undefined) {
				groupedDiagnostics.push(diagnostic)
			}
		}
		return grouped
	}

	@Spec("Pretty prints results with colors in grouped format.")
	public print(results: DiagnosticObject[], options: { suppressSuccessMessage?: boolean } = {}) {
		const suppressSuccessMessage = options.suppressSuccessMessage === true
		if (results.length === 0) {
			if (!suppressSuccessMessage) {
				console.log("✅ No issues found.")
			}
			return
		}

		const notices = results.filter(r => r.severity === "notice")
		const issues = results.filter(r => r.severity !== "notice")
		const hasErrors = results.some(r => r.severity === "error")

		// Print notices first (informational)
		if (notices.length > 0) {
			this.printGrouped(notices, "notice")
		}

		// Print warnings/errors next
		if (issues.length > 0) {
			this.printGrouped(issues)
		}

		// Affirm OK status whenever compile has no errors, even if warnings/notices exist.
		if (!hasErrors && !suppressSuccessMessage) {
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
			const baseDescription = ResultReporter.RULE_DESCRIPTIONS[ruleCode as keyof typeof ResultReporter.RULE_DESCRIPTIONS] || ruleCode
			const coverageDebtMatch = ruleCode === "test-coverage"
				? diagnostics[0]?.message.match(/^test coverage debt\s+([0-9]+(?:\.[0-9]+)?)%:/i)
				: null
			const description = coverageDebtMatch !== null ? `${baseDescription} ${coverageDebtMatch[1]}%` : baseDescription

			console.log(`\n${color}${severity.toUpperCase()}: ${description}${reset}`)

			const byFile = new Map<string, DiagnosticObject[]>()
			for (const diag of diagnostics) {
				if (!byFile.has(diag.file)) {
					byFile.set(diag.file, [])
				}
				const fileDiagnostics = byFile.get(diag.file)
				if (fileDiagnostics !== undefined) {
					fileDiagnostics.push(diag)
				}
			}
			const indent = `  `
			for (const [file, fileDiags] of byFile) {
				const relativePath = path.relative(this.projectRoot, file)
				const single = fileDiags.length === 1
				if (!single) {
					console.log(`${indent}${relativePath}`)
				}
				for (const diag of fileDiags) {
					const displayMessage = ruleCode === "test-coverage"
						? diag.message.replace(/^test coverage debt\s+[0-9]+(?:\.[0-9]+)?%:\s*/i, "")
						: diag.message || ""
					const locationPrefix = diag.line !== undefined
						? single
							? `${indent}${relativePath}:${diag.line}`
							: `${indent}${indent}line ${diag.line}`
						: single
							? (ruleCode === "test-coverage" && file === "project" ? `${indent}` : `${indent}${relativePath}`)
							: `${indent}${indent}`
					console.log(`${locationPrefix} ${displayMessage}`)
				}
			}
		}
	}
}
