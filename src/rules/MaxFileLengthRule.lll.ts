import { Rule } from "../core/rulesEngine/Rule"
import { BaseRule } from "../core/BaseRule.lll"
import { FileVariantSupport } from "../core/FileVariantSupport.lll"
import { Out } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"

@Spec("Enforces a maximum file length in lines for non-test LLLTS files.")
export class MaxFileLengthRule {
	static readonly MAX_LINES = 800

	@Spec("Returns the rule configuration object.")
	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R7",
			title: "Max file length",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()

				// Only apply to .lll.ts files
				if (!filePath.endsWith(".lll.ts")) {
					return []
				}

				// Skip test files
				const variant = FileVariantSupport.getVariantForFile(filePath)
				if (variant !== null && variant.isTest) {
					return []
				}

				const lineCount = sourceFile.getEndLineNumber()

				if (lineCount > MaxFileLengthRule.MAX_LINES) {
					return [
						BaseRule.createError(
							filePath,
							`Found ${lineCount} lines.`,
							"file-too-long",
							1
						)
					]
				}

				return []
			}
		}
	}
}
