import express, { Express, Request, Response } from "express"
import * as fs from "fs"
import * as path from "path"
import { Spec } from "../public/lll.lll"

export type ProjectReport = {
	projectName: string
	projectPath: string
	exists: boolean
	isDirectory: boolean
	testFiles: string[]
}

@Spec("Hosts the foreground HTTP server mode for lllts.")
export class LlltsServer {
	@Spec("Starts an express server that serves project inspection output at '/'.")
	public async start(port: number): Promise<number> {
		const app = this.createApp()
		return new Promise((resolve, reject) => {
			const server = app.listen(port, () => resolve(port))
			server.on("error", reject)
		})
	}

	@Spec("Creates and configures the express application.")
	public createApp(): Express {
		const app = express()

		app.get("/", (req: Request, res: Response) => {
			res.type("text/plain")
			const rawProjectPath = this.readProjectPathQuery(req.query.projectPath)
			if (!rawProjectPath) {
				res.status(400).send(this.buildMissingProjectPathResponse())
				return
			}

			const report = this.inspectProjectPath(rawProjectPath)
			res.status(200).send(this.buildProjectResponse(report))
		})

		return app
	}

	@Spec("Normalizes query input into a single project path value.")
	private readProjectPathQuery(queryValue: unknown): string | null {
		if (Array.isArray(queryValue)) {
			if (queryValue.length === 0) {
				return null
			}
			return this.normalizeProjectPathQueryValue(queryValue[0])
		}
		return this.normalizeProjectPathQueryValue(queryValue)
	}

	@Spec("Normalizes scalar query value and rejects blank values.")
	private normalizeProjectPathQueryValue(queryValue: unknown): string | null {
		if (typeof queryValue !== "string") {
			return null
		}
		const trimmed = queryValue.trim()
		return trimmed.length > 0 ? trimmed : null
	}

	@Spec("Builds the missing-query response in plain text.")
	public buildMissingProjectPathResponse(): string {
		return [
			"projectPath query parameter is required.",
			"Example: /?projectPath=/absolute/or/relative/path"
		].join("\n")
	}

	@Spec("Resolves a project path and captures file-system facts plus discovered tests.")
	public inspectProjectPath(projectPathQuery: string): ProjectReport {
		const resolvedPath = path.resolve(process.cwd(), projectPathQuery)
		const exists = fs.existsSync(resolvedPath)
		const isDirectory = exists && fs.statSync(resolvedPath).isDirectory()
		const projectName = path.basename(resolvedPath)
		const testFiles = isDirectory ? this.findTestFiles(resolvedPath) : []

		return {
			projectName,
			projectPath: resolvedPath,
			exists,
			isDirectory,
			testFiles
		}
	}

	@Spec("Builds deterministic plain-text output for a discovered project path.")
	public buildProjectResponse(report: ProjectReport): string {
		const lines = [
			`Project Name: ${report.projectName}`,
			`Project Path: ${report.projectPath}`,
			`Project Exists: ${String(report.exists)}`,
			`Project Is Directory: ${String(report.isDirectory)}`,
			"Tests:"
		]

		if (report.testFiles.length === 0) {
			lines.push("- (none found)")
		} else {
			for (const testFile of report.testFiles) {
				lines.push(`- ${testFile}`)
			}
		}

		return lines.join("\n")
	}

	@Spec("Recursively scans for '.test.lll.ts' files under the project folder.")
	private findTestFiles(projectPath: string): string[] {
		const matches: string[] = []
		const stack: string[] = [projectPath]

		while (stack.length > 0) {
			const currentPath = stack.pop()
			if (!currentPath) {
				continue
			}
			const entries = fs.readdirSync(currentPath, { withFileTypes: true })
			for (const entry of entries) {
				const fullPath = path.join(currentPath, entry.name)
				if (entry.isDirectory()) {
					stack.push(fullPath)
					continue
				}
				if (entry.isFile() && fullPath.endsWith(".test.lll.ts")) {
					matches.push(this.toPosixPath(path.relative(projectPath, fullPath)))
				}
			}
		}

		matches.sort((a, b) => a.localeCompare(b))
		return matches
	}

	@Spec("Normalizes path separators for stable plain-text output across platforms.")
	private toPosixPath(inputPath: string): string {
		return inputPath.split(path.sep).join("/")
	}
}
