import * as fs from "fs"
import { Out, Spec } from "../public/lll.lll"
import { MustHaveDescRule } from "../rules/MustHaveDescRule.lll"
import { MustHaveOutRule } from "../rules/MustHaveOutRule.lll"
import { MustHaveSpecHeaderRule } from "../rules/MustHaveSpecHeaderRule.lll"
import { MustHaveTestRule } from "../rules/MustHaveTestRule.lll"
import { NoRogueTopLevelRule } from "../rules/NoRogueTopLevelRule.lll"
import { OneClassPerFileRule } from "../rules/OneClassPerFileRule.lll"
import { BaseRule } from "./BaseRule.lll"
import { DiagnosticObject } from "./DiagnosticObject"
import { FileVariantSupport } from "./FileVariantSupport.lll"
import { ProjectInitiator } from "./ProjectInitiator.lll"

@Spec("Loads and executes all rules against project files.")
export class RulesEngine {
	constructor(private loader: ProjectInitiator) { }

	@Spec("Executes all registered rules and returns diagnostics.")
	@Out("diagnostics", "Diagnostic[]")
	public runAll() {
		const files = this.loader.getFiles()
		const rules = [
			OneClassPerFileRule.getRule(),
			NoRogueTopLevelRule.getRule(),
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

			const variant = FileVariantSupport.getVariantForFile(filePath)
			if (!variant || variant.isTest) continue

			const exportedClass = BaseRule.getExportedClass(file)
			if (!exportedClass) continue

			totalClasses++

			const testPath = FileVariantSupport.getTestFilePath(filePath, exportedClass.getName())
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

		const status = this.coverageStatus(totalClasses, coveredClasses)
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

	@Spec("Computes required test coverage ratio for class count.")
	@Out("ratio", "number")
	private requiredCoverage(classCount: number) {
		if (classCount <= 10) return 0
		if (classCount <= 100) return 0.09 + 0.41 * (classCount - 11) / 89
		if (classCount <= 500) return 0.50 + 0.50 * (classCount - 100) / 400
		return 1
	}

	@Spec("Builds test coverage status details from class/test counts.")
	@Out("status", "object")
	private coverageStatus(classCount: number, covered = 0) {
		const classes = Math.max(0, classCount)
		const effectiveCovered = Math.min(Math.max(0, covered), classes)
		const reqRatio = this.requiredCoverage(classes)
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
}
