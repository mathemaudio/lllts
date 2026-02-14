import * as fs from "fs"
import * as path from "path"
import { ProjectInitiator } from "./ProjectInitiator.lll"
import { DiagnosticObject } from "./DiagnosticObject"
import { MustHaveTestRule } from "../rules/MustHaveTestRule.lll"
import { MustHaveSpecHeaderRule } from "../rules/MustHaveSpecHeaderRule.lll"
import { MustHaveDescRule } from "../rules/MustHaveDescRule.lll"
import { OneClassPerFileRule } from "../rules/OneClassPerFileRule.lll"
import { MustHaveOutRule } from "../rules/MustHaveOutRule.lll"
import { Out } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { BaseRule } from "./BaseRule.lll"

@Spec("Loads and executes all rules against project files.")
export class RulesEngine {
	constructor(private loader: ProjectInitiator) { }

	@Spec("Executes all registered rules and returns diagnostics.")
	@Out("diagnostics", "Diagnostic[]")
	public runAll() {
		const files = this.loader.getFiles()
		const rules = [
			OneClassPerFileRule.getRule(),
			MustHaveSpecHeaderRule.getRule(),
			MustHaveDescRule.getRule(),
			MustHaveTestRule.getRule(),
			MustHaveOutRule.getRule(),
		]

		const all: DiagnosticObject[] = []
		for (const file of files) {
			const filePath = file.getFilePath()
			if (filePath.endsWith(".old.ts") || filePath.endsWith(".d.old.ts") || filePath.endsWith("/lll.lll.ts")) {
				continue
			}
			for (const rule of rules) {
				try {
					all.push(...rule.run(file))
				} catch (err) {
					all.push({
						file: file.getBaseName(),
						message: `Rule ${rule.id} crashed: ${String(err)}`,
						severity: "error",
						ruleCode: "no-export" as any
					})
				}
			}
		}
		all.push(...this.computeTestCoverage())
		return all
	}

	@Spec("Calculates project-wide test coverage debt and emits warning/error diagnostics.")
	@Out("diagnostics", "DiagnosticObject[]")
	private computeTestCoverage(): DiagnosticObject[] {
		const files = this.loader.getFiles()
		const fileByPath = new Map<string, import("ts-morph").SourceFile>()
		for (const f of files) {
			fileByPath.set(f.getFilePath(), f)
		}

		let totalClasses = 0
		let coveredClasses = 0

		for (const file of files) {
			const filePath = file.getFilePath()
			if (this.shouldIgnore(filePath)) continue

			const variant = getVariantForFile(filePath)
			if (!variant || variant.isTest) continue

			const exportedClass = BaseRule.getExportedClass(file)
			if (!exportedClass) continue

			totalClasses++

			const testPath = getTestFilePath(filePath, exportedClass.getName())
			if (!testPath || !fs.existsSync(testPath)) continue

			const testFile = fileByPath.get(testPath)
			if (!testFile) continue

			const testClass = BaseRule.getExportedClass(testFile)
			if (!testClass) continue

			const hasScenario = testClass
				.getMethods()
				.some(method => method.isStatic() && BaseRule.hasDecorator(method, "Scenario"))

			if (hasScenario) {
				coveredClasses++
			}
		}

		if (totalClasses <= 5) {
			return []
		}

		const status = coverageStatus(totalClasses, coveredClasses)
		if (status.severity === "ok") {
			return []
		}
		const round = (value: number) => Math.round(value * 10) / 10
		const currentCoverage = round(coveredClasses / totalClasses * 100)
		const currentTarget = round(status.requiredCoveragePercent)
		const isBelow = currentCoverage < currentTarget
		const message = status.requiredMissingTests > 0
			? `test technical debt ${status.debtPercent}% ${status.severity === "error" ? "exceeds safe limit" : "(warning)"}: ${coveredClasses}/${totalClasses} primary classes have tests with scenarios (counted primaries only; project has ${files.length} source files); required ${status.requiredTests}. Add ${status.requiredMissingTests} more to meet the target.`
			: `test coverage is ${currentCoverage}%, ${isBelow ? "below" : "above"} current target of ${currentTarget}%. ${isBelow ? `I recommend adding ${status.idealMissingTests} more tests to reach full coverage.` : `No action required yet.`}`

		if (status.severity === "error") {
			return [BaseRule.createError("project", message, "test-coverage")]
		}
		if (status.severity === "notice") {
			return [BaseRule.createNotice("project", message, "test-coverage")]
		}
		return [BaseRule.createWarning("project", message, "test-coverage")]
	}

	@Spec("Determines whether a file should be skipped from coverage calculations.")
	@Out("ignore", "boolean")
	private shouldIgnore(filePath: string) {
		return filePath.endsWith(".old.ts") || filePath.endsWith(".d.old.ts") || filePath.endsWith("decorators.ts")
	}
}

const FILE_VARIANTS = [
	{ primarySuffix: ".lll.ts", testSuffix: ".test.lll.ts" }
] as const

type FileVariant = (typeof FILE_VARIANTS)[number]
type VariantMatch = { variant: FileVariant; isTest: boolean }

function getTestFilePath(filePath: string, className?: string) {
	const variantMatch = getVariantForFile(filePath)
	if (!variantMatch || variantMatch.isTest) {
		return null
	}
	const parsed = path.parse(filePath)
	const baseName =
		className ??
		(parsed.name.endsWith(".lll") ? parsed.name.slice(0, -".lll".length) : parsed.name)

	return path.join(parsed.dir, `${baseName}.test${variantMatch.variant.primarySuffix}`)
}

function getVariantForFile(filePath: string): VariantMatch | null {
	for (const variant of FILE_VARIANTS) {
		if (filePath.endsWith(variant.testSuffix)) {
			return { variant, isTest: true }
		}

		if (filePath.endsWith(variant.primarySuffix)) {
			return { variant, isTest: false }
		}
	}

	return null
}

function requiredCoverage(C: number) {
	if (C <= 10) return 0;
	if (C <= 100) return 0.09 + 0.41 * (C - 11) / 89
	if (C <= 500) return 0.50 + 0.50 * (C - 100) / 400
	return 1
}

function coverageStatus(C: number, covered = 0) {
	const classes = Math.max(0, C)
	const effectiveCovered = Math.min(Math.max(0, covered), classes)
	const reqRatio = requiredCoverage(classes)
	const required = Math.ceil(reqRatio * classes)
	const idealMissing = Math.max(0, classes - effectiveCovered)
	const requiredMissing = Math.max(0, required - effectiveCovered)
	const debtRequired = required === 0 ? 0 : (requiredMissing / required) * 100
	const debtIdeal = classes === 0 ? 0 : (idealMissing / classes) * 100
	return {
		totalClasses: classes,
		coveredClasses: effectiveCovered,
		requiredCoveragePercent: +(reqRatio * 100).toFixed(2),
		requiredTests: required,
		idealMissingTests: idealMissing,
		requiredMissingTests: requiredMissing,
		debtPercent: +debtRequired.toFixed(2),
		idealDebtPercent: +debtIdeal.toFixed(2),
		severity:
			debtRequired >= 100
				? "error"
				: debtRequired > 0
					? "warning"
					: idealMissing > 0
						? "notice"
						: "ok"
	}
}
