import * as fs from "fs"
import * as path from "path"
import { BaseRule } from "../../core/BaseRule.lll"
import { FileVariantSupport } from "../../core/FileVariantSupport.lll"
import { Rule } from "../../core/rulesEngine/Rule"
import type { RuleContext } from "../../core/rulesEngine/RuleContext"
import { Spec } from "../../public/lll.lll"
import { BreadthRuleLimits } from "./BreadthRuleLimits"

@Spec("Enforces maximum counts of physical source files and subfolders per directory under the entry source root.")
export class MaxFolderBreadthRule {
	static get MAX_FILES(): number {
		return BreadthRuleLimits.getConfig().maxFilesPerFolder
	}

	static get MAX_FOLDERS(): number {
		return BreadthRuleLimits.getConfig().maxSubfoldersPerFolder
	}

	@Spec("Returns the rule configuration object.")
	public static getRule(): Rule {
		return {
			id: "R9",
			title: "Max folder breadth",
			run(sourceFile, context) {
				const filePath = sourceFile.getFilePath()

				if (!MaxFolderBreadthRule.isCountedSourceFile(filePath)) {
					return []
				}

				if (MaxFolderBreadthRule.isTestFile(filePath)) {
					return []
				}

				const loadedRelevantFiles = MaxFolderBreadthRule.getLoadedRelevantFiles(sourceFile)

				if (loadedRelevantFiles.length === 0) {
					return []
				}

				if (!MaxFolderBreadthRule.shouldRunForSourceFile(sourceFile.getFilePath(), loadedRelevantFiles)) {
					return []
				}

				const rootDir = MaxFolderBreadthRule.getSourceRootDir(context, loadedRelevantFiles)
				const sourceFiles = MaxFolderBreadthRule.scanPhysicalSourceFiles(rootDir)
				const folderInfo = MaxFolderBreadthRule.buildFolderInfo(sourceFiles, rootDir)

				const diagnostics = [] as import("../../core/DiagnosticObject").DiagnosticObject[]

				const maxFiles = MaxFolderBreadthRule.MAX_FILES
				const maxFolders = MaxFolderBreadthRule.MAX_FOLDERS

				for (const [dir, info] of folderInfo.entries()) {
					const rel = path.relative(rootDir, dir) || "."

					if (info.files > maxFiles) {
						diagnostics.push(
							BaseRule.createError(
								dir,
								`Folder '${rel}' contains ${info.files} source files (max allowed: ${maxFiles}).`,
								"folder-too-many-files",
								1
							)
						)
					}

					if (info.children.size > maxFolders) {
						diagnostics.push(
							BaseRule.createError(
								dir,
								`Folder '${rel}' contains ${info.children.size} subfolders (max allowed: ${maxFolders}).`,
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
	private static isDotFolder(dir: string): boolean {
		const base = path.basename(dir)
		return base.startsWith(".")
	}

	@Spec("Verifies that a directory is within the computed root boundary.")
	private static isWithinRoot(dir: string, root: string): boolean {
		if (dir === root) {
			return true
		}
		const relative = path.relative(root, dir)
		return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
	}

	@Spec("Determines whether the current file should own project-wide folder breadth diagnostics.")
	private static shouldRunForSourceFile(currentFilePath: string, relevantFiles: import("ts-morph").SourceFile[]): boolean {
		const [firstFile] = relevantFiles
			.map(file => file.getFilePath())
			.sort((left, right) => left.localeCompare(right))

		return firstFile === currentFilePath
	}

	@Spec("Finds graph-loaded non-test source files used only to choose one diagnostic owner.")
	private static getLoadedRelevantFiles(sourceFile: import("ts-morph").SourceFile): import("ts-morph").SourceFile[] {
		return sourceFile.getProject().getSourceFiles().filter(f => {
			const p = f.getFilePath()
			return MaxFolderBreadthRule.isCountedSourceFile(p) && !MaxFolderBreadthRule.isTestFile(p)
		})
	}

	@Spec("Chooses the physical filesystem root for folder breadth counting.")
	private static getSourceRootDir(context: RuleContext | undefined, relevantFiles: import("ts-morph").SourceFile[]): string {
		if (context?.entrySourceRootDir !== null && context?.entrySourceRootDir !== undefined) {
			return path.resolve(context.entrySourceRootDir)
		}
		const [firstFile] = relevantFiles
			.map(file => path.dirname(file.getFilePath()))
			.sort((left, right) => left.localeCompare(right))
		return firstFile !== undefined ? path.resolve(firstFile) : process.cwd()
	}

	@Spec("Recursively scans physical source files under the entry-derived source root.")
	private static scanPhysicalSourceFiles(rootDir: string): string[] {
		if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
			return []
		}

		const files: string[] = []
		const visit = (dir: string) => {
			const entries = fs.readdirSync(dir, { withFileTypes: true })
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name)
				if (entry.isDirectory()) {
					if (!MaxFolderBreadthRule.isDotFolder(fullPath)) {
						visit(fullPath)
					}
					continue
				}
				if (!entry.isFile()) {
					continue
				}
				if (MaxFolderBreadthRule.isCountedSourceFile(fullPath) && !MaxFolderBreadthRule.isTestFile(fullPath)) {
					files.push(path.resolve(fullPath))
				}
			}
		}
		visit(path.resolve(rootDir))
		return files.sort((left, right) => left.localeCompare(right))
	}

	@Spec("Builds direct folder file and source-child counts from physical source files.")
	private static buildFolderInfo(sourceFiles: string[], rootDir: string): Map<string, { files: number; children: Set<string> }> {
		const root = path.resolve(rootDir)
		const folderInfo = new Map<string, { files: number; children: Set<string> }>()
		const ensureFolder = (dir: string) => {
			if (!folderInfo.has(dir)) {
				folderInfo.set(dir, { files: 0, children: new Set<string>() })
			}
		}

		ensureFolder(root)
		for (const sourceFile of sourceFiles) {
			const dir = path.dirname(sourceFile)
			if (!MaxFolderBreadthRule.isWithinRoot(dir, root)) {
				continue
			}
			ensureFolder(dir)
			const info = folderInfo.get(dir)
			if (info !== undefined) {
				info.files++
			}

			let current = dir
			while (current !== root) {
				const parent = path.dirname(current)
				if (!MaxFolderBreadthRule.isWithinRoot(parent, root)) {
					break
				}
				ensureFolder(parent)
				const parentInfo = folderInfo.get(parent)
				if (parentInfo !== undefined && !MaxFolderBreadthRule.isDotFolder(current)) {
					parentInfo.children.add(current)
				}
				current = parent
			}
		}

		return folderInfo
	}

	@Spec("Checks whether the file is a TypeScript source file counted by folder breadth.")
	private static isCountedSourceFile(filePath: string): boolean {
		return filePath.endsWith(".ts") && !filePath.endsWith(".d.ts")
	}

	@Spec("Checks whether the file path represents a test file that should be excluded from breadth counts.")
	private static isTestFile(filePath: string): boolean {
		const variant = FileVariantSupport.getVariantForFile(filePath)
		if (variant !== null) {
			return variant.isTest
		}

		return filePath.endsWith(".test.ts")
	}
}
