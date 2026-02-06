
import { Project, SourceFile } from "ts-morph"
import { Spec, Out } from "../public/decorators.js"
import * as fs from "fs"
import * as path from "path"
import { LoadStrategy } from "../LoadStrategy"

type tsconfig_type = {
	include?: string[]
	exclude?: string[]
}


@Spec("Loads a TypeScript project using ts-morph and returns source files.")
export class ProjectInitiator {
	private project: Project
	private config: tsconfig_type

	constructor(private tsconfigPath: string, strategy: LoadStrategy = "from_imports", private entryFile?: string) {
		this.config = this.loadTsConfig(tsconfigPath)

		// When using from_imports strategy, don't auto-load files from tsconfig
		if (strategy === "from_imports") {
			this.project = new Project({
				tsConfigFilePath: tsconfigPath,
				skipAddingFilesFromTsConfig: true
			})
			if (!entryFile) {
				throw new Error("Entry file is required when using 'from_imports' strategy")
			}
			this.addSourceFilesFromImports(entryFile)
		} else {
			this.project = new Project({ tsConfigFilePath: tsconfigPath })
			this.addSourceFilesFromFolder()
		}
		console.log(`📚 Verifying ${this.project.getSourceFiles().length} source files, strategy: ${strategy}\n`)
	}

	@Spec("Reads and parses the tsconfig.json file to get include/exclude patterns.")
	@Out("config", "tsconfig_type")
	private loadTsConfig(configPath: string) {
		const configContent = fs.readFileSync(configPath, "utf-8")
		return JSON.parse(configContent)
	}

	@Spec("Adds source files to the project using include/exclude patterns from tsconfig.")
	private addSourceFilesFromFolder() {
		const patterns: string[] = []

		// Add include patterns
		if (this.config.include?.length) {
			patterns.push(...this.config.include)
		}

		// Add exclude patterns with ! prefix
		if (this.config.exclude?.length) {
			patterns.push(...this.config.exclude.map(pattern => `!${pattern}`))
		}

		this.project.addSourceFilesAtPaths(patterns)
	}

	@Spec("Recursively follows imports from entry file to build file list.")

	private addSourceFilesFromImports(entryFile: string) {
		const visited = new Set<string>()
		const configDir = path.dirname(this.tsconfigPath)
		const absoluteEntryPath = path.resolve(configDir, entryFile)

		// Validate that entry file exists before proceeding
		if (!fs.existsSync(absoluteEntryPath)) {
			throw new Error(`Entry file not found: ${absoluteEntryPath}`)
		}

		this.followImportsRecursively(absoluteEntryPath, visited)
	}

	@Spec("Recursively follows all imports from a file, tracking visited files to avoid cycles.")

	private followImportsRecursively(filePath: string, visited: Set<string>) {
		// Normalize the path
		const normalizedPath = path.resolve(filePath)

		// Skip if already visited
		if (visited.has(normalizedPath)) {
			return
		}

		// Mark as visited
		visited.add(normalizedPath)

		// Add the file to the project
		let sourceFile: SourceFile
		try {
			sourceFile = this.project.addSourceFileAtPath(normalizedPath)
			const relative = path.relative(path.dirname(this.tsconfigPath), normalizedPath)
		} catch (error) {
			// File might not exist or not be accessible, skip it
			return
		}

		this.enqueueCompanionFile(normalizedPath, visited)

		// Get all import declarations
		const importDeclarations = sourceFile.getImportDeclarations()

		for (const importDecl of importDeclarations) {
			const moduleSpecifier = importDecl.getModuleSpecifierValue()

			// Skip node_modules imports
			if (!moduleSpecifier.startsWith(".") && !moduleSpecifier.startsWith("/")) {
				continue
			}

			// Resolve the import path
			const sourceDir = path.dirname(normalizedPath)
			const resolvedPath = this.resolveImportPath(sourceDir, moduleSpecifier)

			if (resolvedPath) {
				this.followImportsRecursively(resolvedPath, visited)
			}
		}
	}

	@Spec("Ensures every .lll.ts file brings along its *_usecase counterpart (and vice versa).")
	private enqueueCompanionFile(filePath: string, visited: Set<string>) {
		const companionPath = this.getCompanionPath(filePath)
		if (!companionPath) {
			return
		}
		if (!fs.existsSync(companionPath)) {
			return
		}
		const relative = path.relative(path.dirname(this.tsconfigPath), companionPath)
		this.followImportsRecursively(companionPath, visited)
	}

	@Spec("Derives the paired *_usecase or primary .lll.ts file path.")

	@Out("path", "string | null")
	private getCompanionPath(filePath: string): string | null {
		if (filePath.endsWith("_usecase.lll.ts")) {
			return filePath.replace(/_usecase\.lll\.ts$/, ".lll.ts")
		}
		if (filePath.endsWith(".lll.ts")) {
			return filePath.replace(/\.lll\.ts$/, "_usecase.lll.ts")
		}
		return null
	}

	@Spec("Resolves a relative import to an absolute file path, handling .ts/.lll.ts extensions.")
	@Out("path", "string | null")
	private resolveImportPath(sourceDir: string, moduleSpecifier: string) {
		const possibleExtensions = [".ts", ".lll.ts", ".old.ts", ".d.ts", ".d.old.ts"]
		let basePath = path.resolve(sourceDir, moduleSpecifier)

		// If the module specifier already has an extension, try it directly first
		if (path.extname(moduleSpecifier)) {
			if (fs.existsSync(basePath)) {
				return basePath
			}
			// Also try adding .ts to .lll imports (e.g., ./file.lll -> ./file.lll.ts)
			if (moduleSpecifier.endsWith(".lll")) {
				const pathWithTs = basePath + ".ts"
				if (fs.existsSync(pathWithTs)) {
					return pathWithTs
				}
			}
		}

		// Try different extensions
		for (const ext of possibleExtensions) {
			const pathWithExt = basePath + ext
			if (fs.existsSync(pathWithExt)) {
				return pathWithExt
			}
		}

		// Try index files in directory
		for (const ext of possibleExtensions) {
			const indexPath = path.join(basePath, `index${ext}`)
			if (fs.existsSync(indexPath)) {
				return indexPath
			}
		}

		return null
	}

	@Spec("Returns all source files matching the include/exclude patterns from tsconfig.")

	@Out("files", "SourceFile[]")
	public getFiles() {
		return this.project.getSourceFiles()
	}
}
