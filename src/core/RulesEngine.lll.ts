
import * as fs from "fs"
import * as path from "path"
import { ProjectInitiator } from "./ProjectInitiator.lll"
import { DiagnosticObject } from "./DiagnosticObject"
import { MustHaveUsecaseRule } from "../rules/MustHaveUsecaseRule.lll"
import { MustHaveSpecHeaderRule } from "../rules/MustHaveSpecHeaderRule.lll"
import { MustHaveDescRule } from "../rules/MustHaveDescRule.lll"
import { OneClassPerFileRule } from "../rules/OneClassPerFileRule.lll"
import { MustHaveOutRule } from "../rules/MustHaveOutRule.lll"
import { Spec, Out } from "../public/decorators.js"
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
			MustHaveUsecaseRule.getRule(),
			MustHaveOutRule.getRule(),
		]

		const all: DiagnosticObject[] = []
		for (const file of files) {
			const filePath = file.getFilePath()
			if (filePath.endsWith(".old.ts") || filePath.endsWith(".d.old.ts") || filePath.endsWith("decorators.ts")) {
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
						ruleCode: "no-export" as any // Fallback for crashed rules
					})
				}
			}
		}
		all.push(...this.computeUsecaseCoverage())
		return all
	}

	@Spec("Calculates project-wide use-case coverage debt and emits warning/error diagnostics.")
	@Out("diagnostics", "DiagnosticObject[]")
	private computeUsecaseCoverage(): DiagnosticObject[] {
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
			if (!variant || variant.isUsecase) continue

			const exportedClass = BaseRule.getExportedClass(file)
			if (!exportedClass) continue

			totalClasses++

			const companionPath = getCompanionFilePath(filePath, exportedClass.getName())
			if (!companionPath || !fs.existsSync(companionPath)) continue

			const companionFile = fileByPath.get(companionPath)
			if (!companionFile) continue

			const companionClass = BaseRule.getExportedClass(companionFile)
			if (!companionClass) continue

			const hasScenario = companionClass
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
		const message = status.requiredMissingUseCases > 0
			? `use-case technical debt ${status.debtPercent}% ${status.severity === "error" ? "exceeds safe limit" : "(warning)"}: ${coveredClasses}/${totalClasses} primary classes have companions with scenarios (counted primaries only; project has ${files.length} source files); required ${status.requiredUseCases}. Add ${status.requiredMissingUseCases} more to meet the target.`
			: `use-case coverage is ${currentCoverage}%, ${isBelow ? "below" : "above"} current target of ${currentTarget}%. ${isBelow ? `I recommend adding ${status.idealMissingUseCases} more use cases to reach full coverage.` : `No action required yet.`}`

		if (status.severity === "error") {
			return [BaseRule.createError("project", message, "usecase-coverage")]
		}
		if (status.severity === "notice") {
			return [BaseRule.createNotice("project", message, "usecase-coverage")]
		}
		return [BaseRule.createWarning("project", message, "usecase-coverage")]
	}

	@Spec("Determines whether a file should be skipped from coverage calculations.")
	@Out("ignore", "boolean")
	private shouldIgnore(filePath: string) {
		return filePath.endsWith(".old.ts") || filePath.endsWith(".d.old.ts") || filePath.endsWith("decorators.ts")
	}
}

const FILE_VARIANTS = [
	{ primarySuffix: ".lll.ts", usecaseSuffix: "_usecase.lll.ts" },
	{ primarySuffix: ".ts", usecaseSuffix: "_usecase.ts" }
] as const

type FileVariant = (typeof FILE_VARIANTS)[number]
type VariantMatch = { variant: FileVariant; isUsecase: boolean }

function getCompanionFilePath(filePath: string, className?: string) {
	const variantMatch = getVariantForFile(filePath)
	if (!variantMatch || variantMatch.isUsecase) {
		return null
	}
	const parsed = path.parse(filePath)
	const baseName =
		className ??
		(parsed.name.endsWith(".lll") ? parsed.name.slice(0, -".lll".length) : parsed.name)

	return path.join(parsed.dir, `${baseName}_usecase${variantMatch.variant.primarySuffix}`)
}

function getVariantForFile(filePath: string): VariantMatch | null {
	for (const variant of FILE_VARIANTS) {
		if (filePath.endsWith(variant.usecaseSuffix)) {
			return { variant, isUsecase: true }
		}

		if (filePath.endsWith(variant.primarySuffix)) {
			if (variant.primarySuffix === ".ts" && filePath.endsWith(".d.ts")) {
				continue
			}

			return { variant, isUsecase: false }
		}
	}

	return null
}

function requiredCoverage(C: number) {
	if (C <= 10) return 0;
	if (C <= 100) return 0.09 + 0.41 * (C - 11) / 89;   // 9% at 11 → 50% at 100
	if (C <= 500) return 0.50 + 0.50 * (C - 100) / 400; // 50% → 100% at 500
	return 1;
}

// C = total classes, covered = classes with use cases/tests
function coverageStatus(C: number, covered = 0) {
	const classes = Math.max(0, C);
	const effectiveCovered = Math.min(Math.max(0, covered), classes); // cap over-reporting
	const reqRatio = requiredCoverage(classes);
	const required = Math.ceil(reqRatio * classes);
	const idealMissing = Math.max(0, classes - effectiveCovered);     // ideal = 100% coverage
	const requiredMissing = Math.max(0, required - effectiveCovered); // debt relative to required target
	const debtRequired = required === 0 ? 0 : (requiredMissing / required) * 100; // capped at 100
	const debtIdeal = classes === 0 ? 0 : (idealMissing / classes) * 100; // 0–100, always warning if >0
	return {
		totalClasses: classes,
		coveredClasses: effectiveCovered,
		requiredCoveragePercent: +(reqRatio * 100).toFixed(2),
		requiredUseCases: required,
		idealMissingUseCases: idealMissing,
		requiredMissingUseCases: requiredMissing,
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
	};
}
