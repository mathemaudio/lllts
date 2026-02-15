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
		app.use(async (req: Request, res: Response) => {
			await this.handleProxyRequest(req, res, config)
		})

		return app
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

	@Spec("Builds inline HTML/CSS/JS overlay for discovered test files.")
	@Out("markup", "string")
	private buildTestOverlayMarkup(testFiles: string[]): string {
		const serializedTests = JSON.stringify(testFiles).replace(/</g, "\\u003c")
		const defaultOpenLiteral = LlltsServer.testPanelOpenByDefault ? "true" : "false"
		return `
<!-- LLLTS_TEST_OVERLAY -->
<style id="lllts-overlay-style">
#lllts-test-toggle{position:fixed;left:16px;bottom:16px;z-index:2147483640;padding:10px 14px;border:none;border-radius:10px;background:#0f4c5c;color:#fff;font:600 13px/1.2 ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer}
#lllts-test-panel{position:fixed;left:16px;bottom:68px;z-index:2147483640;width:min(50vw,560px);max-height:70vh;overflow:auto;background:#ffffff;border:1px solid #d9e1e7;border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,.28);padding:14px;display:none}
#lllts-test-panel.lllts-open{display:block}
#lllts-test-panel h3{margin:0 0 8px 0;font:700 14px/1.3 ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;color:#102a43}
#lllts-test-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}
#lllts-test-list button{width:100%;text-align:left;border:1px solid #d9e1e7;border-radius:8px;background:#f7fafc;color:#1f2933;padding:8px 10px;font:500 12px/1.3 ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;cursor:pointer}
#lllts-test-list button:hover{background:#eef4f8}
#lllts-test-empty{font:500 12px/1.3 ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;color:#52606d}
#lllts-test-popup{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483641;min-width:min(90vw,520px);max-width:min(90vw,620px);background:#fff;border:1px solid #d9e1e7;border-radius:12px;padding:16px;box-shadow:0 20px 44px rgba(0,0,0,.32);display:none}
#lllts-test-popup.lllts-open{display:block}
#lllts-test-popup-title{margin:0 0 8px 0;font:700 14px/1.3 ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;color:#102a43}
#lllts-test-popup-body{margin:0 0 8px 0;font:500 12px/1.3 ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;color:#1f2933}
#lllts-test-popup-link{margin:0;font:500 12px/1.3 ui-monospace,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;color:#334e68;word-break:break-all}
#lllts-test-popup-close{margin-top:12px;padding:7px 10px;border:1px solid #d9e1e7;border-radius:8px;background:#f7fafc;cursor:pointer}
</style>
<button id="lllts-test-toggle" type="button">LLLTS Tests</button>
<aside id="lllts-test-panel" aria-label="LLLTS tests panel">
  <h3>Project Tests</h3>
  <p id="lllts-test-empty" hidden>No .test.lll.ts files found.</p>
  <ul id="lllts-test-list"></ul>
</aside>
<div id="lllts-test-popup" role="dialog" aria-modal="false">
  <h4 id="lllts-test-popup-title">Test Preview</h4>
  <p id="lllts-test-popup-body">We will show the test here</p>
  <p id="lllts-test-popup-link"></p>
  <button id="lllts-test-popup-close" type="button">Close</button>
</div>
<script id="lllts-test-data" type="application/json">${serializedTests}</script>
<script id="lllts-overlay-script">
(function(){
  var openByDefault=${defaultOpenLiteral};
  var dataElement=document.getElementById("lllts-test-data");
  if(!dataElement){return;}
  var tests=[];
  try{tests=JSON.parse(dataElement.textContent||"[]");}catch(_error){tests=[];}
  var toggleButton=document.getElementById("lllts-test-toggle");
  var panel=document.getElementById("lllts-test-panel");
  var list=document.getElementById("lllts-test-list");
  var emptyState=document.getElementById("lllts-test-empty");
  var popup=document.getElementById("lllts-test-popup");
  var popupLink=document.getElementById("lllts-test-popup-link");
  var popupClose=document.getElementById("lllts-test-popup-close");
  if(!toggleButton||!panel||!list||!emptyState||!popup||!popupLink||!popupClose){return;}
  if(openByDefault){panel.classList.add("lllts-open");}
  toggleButton.addEventListener("click",function(){panel.classList.toggle("lllts-open");});
  popupClose.addEventListener("click",function(){popup.classList.remove("lllts-open");});
  if(!Array.isArray(tests)||tests.length===0){emptyState.hidden=false;return;}
  emptyState.hidden=true;
  tests.forEach(function(testPath){
    var item=document.createElement("li");
    var button=document.createElement("button");
    button.type="button";
    button.textContent=String(testPath);
    button.addEventListener("click",function(){
      popupLink.textContent=String(testPath);
      popup.classList.add("lllts-open");
    });
    item.appendChild(button);
    list.appendChild(item);
  });
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
