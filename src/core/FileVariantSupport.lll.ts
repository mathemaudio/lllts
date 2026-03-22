import * as path from "path"
import { Spec } from "../public/lll.lll"
import type { VariantMatch } from "./VariantMatch"

@Spec("Provides shared file variant helpers for primary/test file naming.")
export class FileVariantSupport {
	private static readonly FILE_VARIANTS = [
		{ primarySuffix: ".lll.ts", testSuffix: ".test.lll.ts" }
	] as const

	@Spec("Resolves whether a path matches a supported production/test file variant.")
	public static getVariantForFile(filePath: string): VariantMatch | null {
		for (const variant of FileVariantSupport.FILE_VARIANTS) {
			if (filePath.endsWith(variant.testSuffix)) {
				return { variant, isTest: true }
			}

			if (filePath.endsWith(variant.primarySuffix)) {
				return { variant, isTest: false }
			}
		}

		return null
	}

	@Spec("Builds companion test path for a production file path and optional class name override.")
	public static getTestFilePath(filePath: string, className?: string): string | null {
		const variantMatch = FileVariantSupport.getVariantForFile(filePath)
		if (!variantMatch || variantMatch.isTest) {
			return null
		}

		const parsed = path.parse(filePath)
		const baseName =
			className ??
			(parsed.name.endsWith(".lll") ? parsed.name.slice(0, -".lll".length) : parsed.name)

		return path.join(parsed.dir, `${baseName}.test${variantMatch.variant.primarySuffix}`)
	}
}
