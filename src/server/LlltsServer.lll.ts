import express, { Express, Request, Response } from "express"
import * as fs from "fs"
import * as path from "path"
import { Out, Spec } from "../public/lll.lll"

type ProjectReport = {
	projectName: string
	projectPath: string
	exists: boolean
	isDirectory: boolean
	testFiles: string[]
}

type ServerConfig = {
	projectPath: string
	projectClientLink: string
}

@Spec("Hosts the foreground HTTP server mode for lllts.")
export class LlltsServer {
	private static readonly testPanelOpenByDefault = !false
	private static readonly overlayAssetsBasePath = "/__lllts-overlay"
	private static readonly overlayIndexAssetPath = "index.html"
	private static readonly overlayScriptAssetPath = "js/script.js"
	private static readonly overlayStyleAssetPath = "css/style.css"

	@Spec("Starts an express server that proxies a configured client and overlays discovered project tests.")
	@Out("port", "number")
	public async start(port: number, config: ServerConfig): Promise<number> {
		const app = this.createApp(config)
		return new Promise((resolve, reject) => {
			const server = app.listen(port, () => resolve(port))
			server.on("error", reject)
		})
	}

	@Spec("Creates and configures the express application.")
	@Out("app", "Express")
	public createApp(config: ServerConfig): Express {
		const app = express()
		this.registerOverlayAssetRoutes(app)
		app.use(async (req: Request, res: Response) => {
			await this.handleProxyRequest(req, res, config)
		})

		return app
	}

	@Spec("Registers static overlay asset routes served from local CDN files.")
	private registerOverlayAssetRoutes(app: Express): void {
		app.get(`${LlltsServer.overlayAssetsBasePath}/${LlltsServer.overlayIndexAssetPath}`, (_req: Request, res: Response) => {
			this.serveOverlayAsset(res, LlltsServer.overlayIndexAssetPath, "text/html; charset=utf-8")
		})
		app.get(`${LlltsServer.overlayAssetsBasePath}/${LlltsServer.overlayScriptAssetPath}`, (_req: Request, res: Response) => {
			this.serveOverlayAsset(res, LlltsServer.overlayScriptAssetPath, "application/javascript; charset=utf-8")
		})
		app.get(`${LlltsServer.overlayAssetsBasePath}/${LlltsServer.overlayStyleAssetPath}`, (_req: Request, res: Response) => {
			this.serveOverlayAsset(res, LlltsServer.overlayStyleAssetPath, "text/css; charset=utf-8")
		})
	}

	@Spec("Serves one overlay asset file from the server-side CDN directory.")
	private serveOverlayAsset(res: Response, relativeAssetPath: string, contentType: string): void {
		const overlayRoot = this.resolveOverlayAssetsRootPath()
		if (!overlayRoot) {
			res.status(500).type("text/plain").send("Overlay assets directory is unavailable.")
			return
		}
		const absoluteAssetPath = path.join(overlayRoot, relativeAssetPath)
		try {
			const body = fs.readFileSync(absoluteAssetPath)
			res.status(200).type(contentType).send(body)
		} catch {
			res.status(404).type("text/plain").send("Overlay asset not found.")
		}
	}

	@Spec("Resolves CDN root for overlay assets in both ts-source and built-dist executions.")
	@Out("rootPath", "string | null")
	private resolveOverlayAssetsRootPath(): string | null {
		const candidatePaths = [
			path.resolve(__dirname, "cdn"),
			path.resolve(__dirname, "../../src/server/cdn")
		]
		for (const candidatePath of candidatePaths) {
			if (!fs.existsSync(candidatePath)) {
				continue
			}
			if (!fs.statSync(candidatePath).isDirectory()) {
				continue
			}
			return candidatePath
		}
		return null
	}

	@Spec("Handles one incoming request by validating project path and proxying to the configured client.")
	private async handleProxyRequest(req: Request, res: Response, config: ServerConfig): Promise<void> {
		const report = this.inspectProjectPath(config.projectPath)
		if (!report.exists) {
			res.status(404).type("text/plain").send(this.buildProjectPathStateResponse(report, config.projectClientLink, "Project path does not exist."))
			return
		}
		if (!report.isDirectory) {
			res.status(400).type("text/plain").send(this.buildProjectPathStateResponse(report, config.projectClientLink, "Project path exists but is not a directory."))
			return
		}

		const upstreamBaseUrl = this.resolveProjectClientLink(config.projectClientLink)
		if (!upstreamBaseUrl) {
			res.status(502).type("text/plain").send(this.buildProjectClientLinkUnavailableResponse(report, config.projectClientLink, "Invalid projectClientLink format."))
			return
		}

		const upstreamUrl = new URL(req.originalUrl || req.url, upstreamBaseUrl)
		const requestHeaders = this.buildProxyRequestHeaders(req)
		const method = req.method.toUpperCase()
		const shouldSendBody = method !== "GET" && method !== "HEAD"
		const requestBody = shouldSendBody ? await this.readRequestBody(req) : undefined

		let upstreamResponse: globalThis.Response
		try {
			upstreamResponse = await fetch(upstreamUrl.toString(), {
				method,
				headers: requestHeaders,
				body: requestBody ? new Uint8Array(requestBody) : undefined
			})
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			res.status(502).type("text/plain").send(this.buildProjectClientLinkUnavailableResponse(report, config.projectClientLink, `Upstream request failed: ${reason}`))
			return
		}

		await this.forwardUpstreamResponse(res, upstreamResponse, report)
	}

	@Spec("Resolves a project path and captures file-system facts plus discovered tests.")
	@Out("report", "ProjectReport")
	public inspectProjectPath(projectPathInput: string): ProjectReport {
		const resolvedPath = path.resolve(process.cwd(), projectPathInput)
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

	@Spec("Builds deterministic plain-text output when project path preconditions are not satisfied.")
	@Out("text", "string")
	public buildProjectPathStateResponse(report: ProjectReport, projectClientLink: string, reason: string): string {
		const lines = [
			reason,
			`Project Name: ${report.projectName}`,
			`Project Path: ${report.projectPath}`,
			`Project Exists: ${String(report.exists)}`,
			`Project Is Directory: ${String(report.isDirectory)}`,
			`Project Client Link: ${projectClientLink.trim()}`
		]

		return lines.join("\n")
	}

	@Spec("Builds deterministic plain-text output when configured client link cannot be reached.")
	@Out("text", "string")
	public buildProjectClientLinkUnavailableResponse(report: ProjectReport, projectClientLink: string, reason: string): string {
		const lines = [
			"Project client link is unavailable.",
			`Reason: ${reason}`,
			`Project Name: ${report.projectName}`,
			`Project Path: ${report.projectPath}`,
			`Project Exists: ${String(report.exists)}`,
			`Project Is Directory: ${String(report.isDirectory)}`,
			`Project Client Link: ${projectClientLink.trim()}`,
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

	@Spec("Resolves loose project client link input into a URL; defaults to http:// when scheme is omitted.")
	@Out("url", "URL | null")
	private resolveProjectClientLink(projectClientLinkInput: string): URL | null {
		const trimmed = projectClientLinkInput.trim()
		if (trimmed.length === 0) {
			return null
		}
		const direct = this.tryParseUrl(trimmed)
		if (direct) {
			return direct
		}
		if (this.hasExplicitUrlScheme(trimmed)) {
			return null
		}
		return this.tryParseUrl(`http://${trimmed}`)
	}

	@Spec("Parses a URL and returns null instead of throwing.")
	@Out("url", "URL | null")
	private tryParseUrl(urlInput: string): URL | null {
		try {
			return new URL(urlInput)
		} catch {
			return null
		}
	}

	@Spec("Checks whether an input string starts with a URL scheme.")
	@Out("hasScheme", "boolean")
	private hasExplicitUrlScheme(urlInput: string): boolean {
		return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(urlInput)
	}

	@Spec("Builds request headers for upstream fetch while removing hop-by-hop values.")
	@Out("headers", "Record<string, string>")
	private buildProxyRequestHeaders(req: Request): Record<string, string> {
		const headers: Record<string, string> = {}
		for (const [name, value] of Object.entries(req.headers)) {
			if (value === undefined) {
				continue
			}
			const normalizedName = name.toLowerCase()
			if (normalizedName === "host" || normalizedName === "connection" || normalizedName === "content-length") {
				continue
			}
			headers[normalizedName] = Array.isArray(value) ? value.join(", ") : value
		}
		headers["accept-encoding"] = "identity"
		return headers
	}

	@Spec("Reads the full incoming request body into a buffer.")
	@Out("body", "Buffer")
	private async readRequestBody(req: Request): Promise<Buffer> {
		return await new Promise((resolve, reject) => {
			const chunks: Buffer[] = []
			req.on("data", (chunk: Buffer | string) => {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
			})
			req.on("end", () => resolve(Buffer.concat(chunks)))
			req.on("error", reject)
		})
	}

	@Spec("Forwards upstream response and injects test overlay into HTML payloads.")
	private async forwardUpstreamResponse(res: Response, upstreamResponse: globalThis.Response, report: ProjectReport): Promise<void> {
		const contentType = upstreamResponse.headers.get("content-type") ?? ""
		const bodyBuffer = Buffer.from(await upstreamResponse.arrayBuffer())
		const isHtml = contentType.toLowerCase().includes("text/html")

		if (isHtml) {
			const upstreamHtml = bodyBuffer.toString("utf8")
			const htmlWithOverlay = this.injectOverlayIntoHtml(upstreamHtml, report.testFiles)
			this.copyUpstreamResponseHeaders(res, upstreamResponse, true)
			res.status(upstreamResponse.status)
			res.send(htmlWithOverlay)
			return
		}

		this.copyUpstreamResponseHeaders(res, upstreamResponse, false)
		res.status(upstreamResponse.status)
		res.send(bodyBuffer)
	}

	@Spec("Copies response headers from upstream to express response, handling content-length/set-cookie correctly.")
	private copyUpstreamResponseHeaders(res: Response, upstreamResponse: globalThis.Response, omitContentLength: boolean): void {
		for (const [name, value] of upstreamResponse.headers.entries()) {
			const normalizedName = name.toLowerCase()
			if (normalizedName === "set-cookie") {
				continue
			}
			if (omitContentLength && normalizedName === "content-length") {
				continue
			}
			res.setHeader(name, value)
		}

		const headersWithCookies = upstreamResponse.headers as unknown as { getSetCookie?: () => string[] }
		if (typeof headersWithCookies.getSetCookie === "function") {
			const cookies = headersWithCookies.getSetCookie()
			if (cookies.length > 0) {
				res.setHeader("set-cookie", cookies)
			}
		}
	}

	@Spec("Injects overlay UI into HTML by inserting before closing body tag when present.")
	@Out("html", "string")
	private injectOverlayIntoHtml(html: string, testFiles: string[]): string {
		const overlayMarkup = this.buildTestOverlayMarkup(testFiles)
		if (/<\/body>/i.test(html)) {
			return html.replace(/<\/body>/i, `${overlayMarkup}</body>`)
		}
		return `${html}${overlayMarkup}`
	}

	@Spec("Builds minimal inline overlay config plus loader that pulls CDN-hosted UI assets.")
	@Out("markup", "string")
	private buildTestOverlayMarkup(testFiles: string[]): string {
		const serializedConfig = JSON.stringify({
			tests: testFiles,
			openByDefault: LlltsServer.testPanelOpenByDefault,
			assetsBasePath: LlltsServer.overlayAssetsBasePath
		}).replace(/</g, "\\u003c")
		return /*html*/`
<!-- LLLTS_TEST_OVERLAY -->
<script id="lllts-overlay-config" type="application/json">${serializedConfig}</script>
<script id="lllts-overlay-loader">
(function(){
  var assetsBasePath="${LlltsServer.overlayAssetsBasePath}";
  if(!document.getElementById("lllts-overlay-runtime-style")){
    var style=document.createElement("link");
    style.id="lllts-overlay-runtime-style";
    style.rel="stylesheet";
    style.href=assetsBasePath+"/${LlltsServer.overlayStyleAssetPath}";
    document.head.appendChild(style);
  }
  if(document.getElementById("lllts-overlay-runtime-script")){return;}
  var runtimeScript=document.createElement("script");
  runtimeScript.id="lllts-overlay-runtime-script";
  runtimeScript.src=assetsBasePath+"/${LlltsServer.overlayScriptAssetPath}";
  runtimeScript.defer=true;
  document.body.appendChild(runtimeScript);
})();
</script>`
	}

	@Spec("Recursively scans for '.test.lll.ts' files under the project folder.")
	@Out("testFiles", "string[]")
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
	@Out("normalizedPath", "string")
	private toPosixPath(inputPath: string): string {
		return inputPath.split(path.sep).join("/")
	}
}
