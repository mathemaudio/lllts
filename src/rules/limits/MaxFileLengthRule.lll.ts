import { BaseRule } from "../../core/BaseRule.lll"
import { FileVariantSupport } from "../../core/variants/FileVariantSupport.lll"
import { Rule } from "../../core/rulesEngine/Rule"
import { Spec } from "../../public/lll.lll"
import { BreadthRuleLimits } from "./BreadthRuleLimits"

@Spec("Enforces a maximum file length in lines for non-test LLLTS files.")
export class MaxFileLengthRule {
	static get MAX_LINES(): number {
		return BreadthRuleLimits.getConfig().maxFileLines
	}

	@Spec("Returns the rule configuration object.")
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

				const maxLines = MaxFileLengthRule.MAX_LINES
				if (lineCount > maxLines) {
					return [
						BaseRule.createError(
							filePath,
							`Found ${lineCount} lines (max allowed: ${maxLines}).`,
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
