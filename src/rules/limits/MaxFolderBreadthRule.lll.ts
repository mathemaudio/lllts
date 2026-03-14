import * as path from "path"
import { Rule } from "../../core/rulesEngine/Rule"
import { BaseRule } from "../../core/BaseRule.lll"
import { FileVariantSupport } from "../../core/FileVariantSupport.lll"
import { Out } from "../../public/lll.lll"
import { Spec } from "../../public/lll.lll"

@Spec("Enforces maximum counts of source files and subfolders per directory in the loaded source tree.")
export class MaxFolderBreadthRule {
	static readonly MAX_FILES = 12
	static readonly MAX_FOLDERS = 8

	@Spec("Returns the rule configuration object.")
	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R9",
			title: "Max folder breadth",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()

				if (!MaxFolderBreadthRule.isCountedSourceFile(filePath)) {
					return []
				}

				if (MaxFolderBreadthRule.isTestFile(filePath)) {
					return []
				}

				const project = sourceFile.getProject()
				const relevantFiles = project.getSourceFiles().filter(f => {
					const p = f.getFilePath()
					return MaxFolderBreadthRule.isCountedSourceFile(p) && !MaxFolderBreadthRule.isTestFile(p)
				})

				if (relevantFiles.length === 0) {
					return []
				}

				if (!MaxFolderBreadthRule.shouldRunForSourceFile(sourceFile.getFilePath(), relevantFiles)) {
					return []
				}

				const directories = relevantFiles.map(f => path.dirname(f.getFilePath()))
				const rootDir = MaxFolderBreadthRule.getCommonDir(directories)

				const folderInfo = new Map<string, { files: number; children: Set<string> }>()

				const ensureFolder = (dir: string) => {
					if (!folderInfo.has(dir)) {
						folderInfo.set(dir, { files: 0, children: new Set<string>() })
					}
				}

				const isWithinRoot = (dir: string) => MaxFolderBreadthRule.isWithinRoot(dir, rootDir)
				const isDotFolder = (dir: string) => MaxFolderBreadthRule.isDotFolder(dir)

				directories.forEach(dir => {
					ensureFolder(dir)
					if (!isDotFolder(dir)) {
						const info = folderInfo.get(dir)
						if (info !== undefined) {
							info.files += 1
						}
					}

					let current = dir
					while (true) {
						const parent = path.dirname(current)
						if (!isWithinRoot(parent)) {
							break
						}

						ensureFolder(parent)
						ensureFolder(current)

						if (!isDotFolder(current)) {
							const parentInfo = folderInfo.get(parent)
							if (parentInfo !== undefined) {
								parentInfo.children.add(current)
							}
						}

						if (parent === current || current === rootDir) {
							break
						}

						current = parent
					}
				})

				const diagnostics = [] as import("../../core/DiagnosticObject").DiagnosticObject[]

				for (const [dir, info] of folderInfo.entries()) {
					const rel = path.relative(rootDir, dir) || "."

					if (info.files > MaxFolderBreadthRule.MAX_FILES) {
						diagnostics.push(
							BaseRule.createError(
								dir,
								`Folder '${rel}' contains ${info.files} source files (max allowed: ${MaxFolderBreadthRule.MAX_FILES}).`,
								"folder-too-many-files",
								1
							)
						)
					}

					if (info.children.size > MaxFolderBreadthRule.MAX_FOLDERS) {
						diagnostics.push(
							BaseRule.createError(
								dir,
								`Folder '${rel}' contains ${info.children.size} subfolders (max allowed: ${MaxFolderBreadthRule.MAX_FOLDERS}).`,
								"folder-too-many-folders",
								1
							)
						)
					}
				}

				return diagnostics
			}
		}
	}

	@Spec("Checks whether a directory name represents a dot-prefixed system folder.")
	@Out("isSystem", "boolean")
	private static isDotFolder(dir: string) {
		const base = path.basename(dir)
		return base.startsWith(".")
	}

	@Spec("Verifies that a directory is within the computed root boundary.")
	@Out("withinRoot", "boolean")
	private static isWithinRoot(dir: string, root: string) {
		if (dir === root) {
			return true
		}
		const relative = path.relative(root, dir)
		return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
	}

	@Spec("Computes the deepest common ancestor directory for the provided paths.")
	@Out("commonDir", "string")
	private static getCommonDir(dirs: string[]) {
		const normalized = dirs.map(d => path.resolve(d))
		const [first, ...rest] = normalized
		let commonParts = first.split(path.sep).filter(Boolean)

		for (const dir of rest) {
			const parts = dir.split(path.sep).filter(Boolean)
			let i = 0
			while (i < commonParts.length && i < parts.length && commonParts[i] === parts[i]) {
				i += 1
			}
			commonParts = commonParts.slice(0, i)
		}

		if (commonParts.length === 0) {
			return path.parse(first).root
		}

		const candidate = path.join(path.parse(first).root, ...commonParts)
		return candidate === "" ? path.parse(first).root : candidate
	}

	@Spec("Determines whether the current file should own project-wide folder breadth diagnostics.")
	@Out("shouldRun", "boolean")
	private static shouldRunForSourceFile(currentFilePath: string, relevantFiles: import("ts-morph").SourceFile[]) {
		const [firstFile] = relevantFiles
			.map(file => file.getFilePath())
			.sort((left, right) => left.localeCompare(right))

		return firstFile === currentFilePath
	}

	@Spec("Checks whether the file is a TypeScript source file counted by folder breadth.")
	@Out("isCounted", "boolean")
	private static isCountedSourceFile(filePath: string) {
		return filePath.endsWith(".ts") && !filePath.endsWith(".d.ts")
	}

	@Spec("Checks whether the file path represents a test file that should be excluded from breadth counts.")
	@Out("isTest", "boolean")
	private static isTestFile(filePath: string) {
		const variant = FileVariantSupport.getVariantForFile(filePath)
		if (variant !== null) {
			return variant.isTest
		}

		return filePath.endsWith(".test.ts")
	}
}
