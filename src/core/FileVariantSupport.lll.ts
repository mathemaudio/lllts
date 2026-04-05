import * as path from "path"
import { Spec } from "../public/lll.lll"
import type { VariantMatch } from "./VariantMatch"

@Spec("Provides shared file variant helpers for primary/test file naming.")
export class FileVariantSupport {
	private static readonly FILE_VARIANTS = [
		{ primarySuffix: ".lll.ts", testSuffix: ".test.lll.ts", testClassSuffix: "Test" },
		{ primarySuffix: ".lll.ts", testSuffix: ".test2.lll.ts", testClassSuffix: "Test2" }
	] as const

	@Spec("Resolves whether a path matches a supported production/test file variant.")
	public static getVariantForFile(filePath: string): VariantMatch | null {
		for (const variant of FileVariantSupport.FILE_VARIANTS) {
			if (filePath.endsWith(variant.testSuffix)) {
				return { variant, isTest: true }
			}
		}

		for (const variant of FileVariantSupport.FILE_VARIANTS) {
			if (filePath.endsWith(variant.primarySuffix)) {
				return { variant, isTest: false }
			}
		}

		return null
	}

	@Spec("Returns true when a file path is one of the supported test companion variants.")
	public static isTestFilePath(filePath: string): boolean {
		return FileVariantSupport.getVariantForFile(filePath)?.isTest === true
	}

	@Spec("Builds all supported companion test paths for a production file path and optional class name override.")
	public static getTestFilePaths(filePath: string, className?: string): string[] {
		const variantMatch = FileVariantSupport.getVariantForFile(filePath)
		if (!variantMatch || variantMatch.isTest) {
			return []
		}

		const parsed = path.parse(filePath)
		const baseName =
			className ??
			(parsed.name.endsWith(".lll") ? parsed.name.slice(0, -".lll".length) : parsed.name)

		return FileVariantSupport.FILE_VARIANTS.map(variant =>
			path.join(parsed.dir, `${baseName}${variant.testSuffix.slice(0, -variant.primarySuffix.length)}${variant.primarySuffix}`)
		)
	}

	@Spec("Builds one companion test path for a production file path, keyed by a supported test suffix.")
	public static getTestFilePath(filePath: string, className?: string, testSuffix = ".test.lll.ts"): string | null {
		const parsed = path.parse(filePath)
		const baseName =
			className ??
			(parsed.name.endsWith(".lll") ? parsed.name.slice(0, -".lll".length) : parsed.name)
		const variant = FileVariantSupport.FILE_VARIANTS.find(candidate => candidate.testSuffix === testSuffix)
		if (!variant) {
			return null
		}
		if (FileVariantSupport.getVariantForFile(filePath)?.isTest === true) {
			return null
		}
		return path.join(parsed.dir, `${baseName}${variant.testSuffix.slice(0, -variant.primarySuffix.length)}${variant.primarySuffix}`)
	}

	@Spec("Builds the primary file path represented by a companion test file path.")
	public static getPrimaryFilePath(filePath: string): string | null {
		const variantMatch = FileVariantSupport.getVariantForFile(filePath)
		if (!variantMatch || !variantMatch.isTest) {
			return null
		}

		return filePath.slice(0, -variantMatch.variant.testSuffix.length) + variantMatch.variant.primarySuffix
	}

	@Spec("Extracts the host class name represented by a companion test file path.")
	public static getHostClassNameFromTestPath(filePath: string): string | null {
		const variantMatch = FileVariantSupport.getVariantForFile(filePath)
		if (!variantMatch || !variantMatch.isTest) {
			return null
		}

		return path.basename(filePath).slice(0, -variantMatch.variant.testSuffix.length)
	}

	@Spec("Builds the exact expected exported class name for a supported test file path.")
	public static getExpectedTestClassName(filePath: string): string | null {
		const variantMatch = FileVariantSupport.getVariantForFile(filePath)
		const hostClassName = FileVariantSupport.getHostClassNameFromTestPath(filePath)
		if (!variantMatch || !variantMatch.isTest || hostClassName === null) {
			return null
		}

		return `${hostClassName}${variantMatch.variant.testClassSuffix}`
	}
}
