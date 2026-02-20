import * as fs from "fs"
import * as http from "http"
import * as os from "os"
import * as path from "path"
import { AssertFn, Out, Scenario, Spec } from "../public/lll.lll.js"
import { LlltsServer } from "./LlltsServer.lll.js"
import type { ServerConfig } from "./ServerConfig"

@Spec("Unit scenarios for LlltsServer proxying, runtime checks, and injected test overlay behavior.")
export class LlltsServerTest {
	testType = "unit"

	@Spec("Runs a single request against an ephemeral listener and returns status/body.")
	@Out("response", "{ status: number; contentType: string; body: string }")
	private static async request(
		app: ReturnType<LlltsServer["createApp"]>,
		requestPath: string,
		options: { method?: string; headers?: Record<string, string>; body?: string | Uint8Array } = {}
	) {
		const listener = http.createServer(app)
		await new Promise<void>((resolve, reject) => {
			listener.listen(0, "127.0.0.1", () => resolve())
			listener.on("error", reject)
		})

		try {
			const address = listener.address()
			if (address === null || typeof address === "string") {
				throw new Error("Listener should expose an ephemeral port")
			}
			const requestInit: RequestInit = {
				method: options.method ?? "GET",
				headers: options.headers
			}
			if (options.body !== undefined) {
				requestInit.body = options.body as unknown as never
			}
			const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`, requestInit)
			return {
				status: response.status,
				contentType: response.headers.get("content-type") ?? "",
				body: await response.text()
			}
		} finally {
			await new Promise<void>((resolve, reject) => {
				listener.close(error => {
					if (error) {
						reject(error)
						return
					}
					resolve()
				})
			})
		}
	}

	@Spec("Starts an ephemeral upstream server and returns its URL plus a close callback.")
	@Out("upstream", "{ url: string; close: () => Promise<void> }")
	private static async startUpstreamServer(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): Promise<{ url: string; close: () => Promise<void> }> {
		const listener = http.createServer(handler)
		await new Promise<void>((resolve, reject) => {
			listener.listen(0, "127.0.0.1", () => resolve())
			listener.on("error", reject)
		})
		const address = listener.address()
		if (address === null || typeof address === "string") {
			throw new Error("Upstream listener should expose an ephemeral port")
		}
		return {
			url: `http://127.0.0.1:${address.port}`,
			close: async () => {
				await new Promise<void>((resolve, reject) => {
					listener.close(error => {
						if (error) {
							reject(error)
							return
						}
						resolve()
					})
				})
			}
		}
	}

	@Scenario("Missing project path on filesystem returns 404 with diagnostics")
	static async missingProjectPathResponse(input: object = {}, assert: AssertFn) {
		const server = new LlltsServer()
		const uniquePath = path.join(os.tmpdir(), `lllts-missing-${Date.now()}-${Math.random().toString(16).slice(2)}`)
		const config: ServerConfig = {
			projectPath: uniquePath,
			projectClientLink: "http://127.0.0.1:39999"
		}
		const app = server.createApp(config)
		const response = await this.request(app, "/")
		assert(response.status === 404, "Missing project path should return HTTP 404")
		assert(response.contentType.includes("text/plain"), "Missing project path should return text/plain")
		assert(response.body.includes("Project path does not exist."), "Response should explain missing project path")
		assert(response.body.includes("Project Exists: false"), "Missing project path should report exists false")
	}

	@Scenario("Project path that exists as file returns 400 with diagnostics")
	static async nonDirectoryProjectPathResponse(input: object = {}, assert: AssertFn) {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-server-file-"))
		const filePath = path.join(tempRoot, "not-a-dir.txt")
		fs.writeFileSync(filePath, "x\n")

		try {
			const server = new LlltsServer()
			const config: ServerConfig = {
				projectPath: filePath,
				projectClientLink: "http://127.0.0.1:39999"
			}
			const app = server.createApp(config)
			const response = await this.request(app, "/")
			assert(response.status === 400, "File project path should return HTTP 400")
			assert(response.body.includes("Project path exists but is not a directory."), "Response should explain non-directory path")
			assert(response.body.includes("Project Is Directory: false"), "Non-directory path should report directory false")
		} finally {
			fs.rmSync(tempRoot, { recursive: true, force: true })
		}
	}

	@Scenario("Unreachable project client link returns 502 with diagnostics")
	static async unreachableProjectClientLinkResponse(input: object = {}, assert: AssertFn) {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-server-upstream-"))
		const testFile = path.join(tempRoot, "src", "Alpha.test.lll.ts")
		fs.mkdirSync(path.dirname(testFile), { recursive: true })
		fs.writeFileSync(testFile, "export class AlphaTest {}\n")

		try {
			const server = new LlltsServer()
			const config: ServerConfig = {
				projectPath: tempRoot,
				projectClientLink: "http://127.0.0.1:1"
			}
			const app = server.createApp(config)
			const response = await this.request(app, "/")
			assert(response.status === 502, "Unreachable client link should return HTTP 502")
			assert(response.body.includes("Project client link is unavailable."), "Response should explain unavailable client link")
			assert(response.body.includes("- src/Alpha.test.lll.ts"), "Response should preserve discovered test listing")
		} finally {
			fs.rmSync(tempRoot, { recursive: true, force: true })
		}
	}

	@Scenario("Reachable upstream HTML is proxied and injected with overlay test UI")
	static async proxiedHtmlIncludesOverlay(input: object = {}, assert: AssertFn) {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-server-html-"))
		const testFileA = path.join(tempRoot, "tests", "Alpha.test.lll.ts")
		const testFileB = path.join(tempRoot, "tests", "nested", "Beta.test.lll.ts")
		fs.mkdirSync(path.dirname(testFileB), { recursive: true })
		fs.writeFileSync(
			testFileA,
			`export class AlphaTest {
	@Scenario("Alpha first scenario")
	static async alphaFirst() {}
}
`
		)
		fs.writeFileSync(
			testFileB,
			`export class BetaTest {
	@Scenario("Beta scenario")
	static async betaScenario() {}
}
`
		)

		const upstream = await this.startUpstreamServer((_req, res) => {
			res.statusCode = 200
			res.setHeader("content-type", "text/html; charset=utf-8")
			res.end("<html><body><main id='client-root'>Client App</main></body></html>")
		})

		try {
			const server = new LlltsServer()
			const config: ServerConfig = {
				projectPath: tempRoot,
				projectClientLink: upstream.url
			}
			const app = server.createApp(config)
			const response = await this.request(app, "/app?page=1")
			assert(response.status === 200, "Successful upstream HTML should return HTTP 200")
			assert(response.body.includes("Client App"), "Response should include upstream HTML")
			assert(response.body.includes("LLLTS_TEST_OVERLAY"), "Response should include overlay marker")
			assert(response.body.includes("lllts-overlay-config"), "Response should include serialized overlay config element")
			assert(response.body.includes("lllts-overlay-loader"), "Response should include runtime loader script")
			assert(response.body.includes("scenariosScript.src=assetsBasePath+\"/js/scenarios.js\""), "Loader should reference external scenario helper script")
			assert(response.body.includes("runtimeScript.src=assetsBasePath+\"/js/script.js\""), "Loader should reference external overlay runtime script")
			assert(response.body.includes("style.href=assetsBasePath+\"/css/style.css\""), "Loader should reference external overlay stylesheet")
			assert(response.body.includes("\"assetsBasePath\":\"/__lllts-overlay\""), "Overlay config should include CDN base path")
			assert(response.body.includes("tests/Alpha.test.lll.ts"), "Overlay should include top-level test path")
			assert(response.body.includes("tests/nested/Beta.test.lll.ts"), "Overlay should include nested test path")
			assert(response.body.includes("\"testScenarios\""), "Overlay config should include test scenario metadata map")
			assert(response.body.includes("\"methodName\":\"alphaFirst\""), "Overlay config should include discovered scenario method name")
			assert(response.body.includes("\"title\":\"Alpha first scenario\""), "Overlay config should include discovered scenario title")
		} finally {
			await upstream.close()
			fs.rmSync(tempRoot, { recursive: true, force: true })
		}
	}

	@Scenario("Overlay CDN assets are served by local server routes")
	static async overlayAssetsAreServed(input: object = {}, assert: AssertFn) {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-server-overlay-assets-"))
		const upstream = await this.startUpstreamServer((_req, res) => {
			res.statusCode = 200
			res.setHeader("content-type", "text/plain; charset=utf-8")
			res.end("upstream")
		})

		try {
			const server = new LlltsServer()
			const config: ServerConfig = {
				projectPath: tempRoot,
				projectClientLink: upstream.url
			}
			const app = server.createApp(config)

			const templateResponse = await this.request(app, "/__lllts-overlay/index.html")
			assert(templateResponse.status === 200, "Overlay template route should return HTTP 200")
			assert(templateResponse.contentType.includes("text/html"), "Overlay template route should return text/html")
			assert(templateResponse.body.includes("LLLTS Tests"), "Overlay template should include toggle markup")

			const scriptResponse = await this.request(app, "/__lllts-overlay/js/script.js")
			assert(scriptResponse.status === 200, "Overlay script route should return HTTP 200")
			assert(scriptResponse.contentType.includes("application/javascript"), "Overlay script route should return javascript content-type")
			assert(scriptResponse.body.includes("await import(moduleUrl)"), "Overlay script should include dynamic module import logic")
			assert(scriptResponse.body.includes("testType === \"behavioral\""), "Overlay script should include behavioral branching logic")
			assert(scriptResponse.body.includes("customElements.define(tagName, PreviewElementClass)"), "Overlay script should define preview custom elements")
			assert(scriptResponse.body.includes("scenarioApi.runScenarioMethod"), "Overlay script should execute scenario methods via helper API")
			assert(scriptResponse.body.includes("FIXED_llltsLastRunReport"), "Overlay script should expose fixed string report variable")
			assert(scriptResponse.body.includes("FIXED_llltsLastRunReportJson"), "Overlay script should expose fixed JSON report variable")
			assert(scriptResponse.body.includes("setFixedLastRunReport"), "Overlay script should assign fixed report globals at completion")
			assert(scriptResponse.body.includes("runPanelPlayAllSequence(true)"), "Overlay script should auto-run Play All on page load")

			const scenariosScriptResponse = await this.request(app, "/__lllts-overlay/js/scenarios.js")
			assert(scenariosScriptResponse.status === 200, "Overlay scenarios helper route should return HTTP 200")
			assert(scenariosScriptResponse.contentType.includes("application/javascript"), "Overlay scenarios helper route should return javascript content-type")
			assert(scenariosScriptResponse.body.includes("globalScope.llltsOverlayScenarios"), "Scenarios helper should expose global scenario API")
			assert(scenariosScriptResponse.body.includes("function runScenarioMethod"), "Scenarios helper should include runtime scenario invocation function")

			const styleResponse = await this.request(app, "/__lllts-overlay/css/style.css")
			assert(styleResponse.status === 200, "Overlay style route should return HTTP 200")
			assert(styleResponse.contentType.includes("text/css"), "Overlay style route should return text/css")
			assert(styleResponse.body.includes("#lllts-test-toggle"), "Overlay stylesheet should include toggle styles")
		} finally {
			await upstream.close()
			fs.rmSync(tempRoot, { recursive: true, force: true })
		}
	}

	@Scenario("Reachable upstream non-HTML content is forwarded without overlay injection")
	static async proxiedNonHtmlPassThrough(input: object = {}, assert: AssertFn) {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-server-asset-"))
		const upstream = await this.startUpstreamServer((_req, res) => {
			res.statusCode = 200
			res.setHeader("content-type", "text/plain; charset=utf-8")
			res.end("plain-asset-body")
		})

		try {
			const server = new LlltsServer()
			const config: ServerConfig = {
				projectPath: tempRoot,
				projectClientLink: upstream.url
			}
			const app = server.createApp(config)
			const response = await this.request(app, "/assets/file.txt")
			assert(response.status === 200, "Non-HTML upstream should keep status")
			assert(response.contentType.includes("text/plain"), "Non-HTML upstream content-type should be preserved")
			assert(response.body === "plain-asset-body", "Non-HTML upstream body should be preserved without modification")
			assert(!response.body.includes("LLLTS_TEST_OVERLAY"), "Overlay should not be injected into non-HTML responses")
		} finally {
			await upstream.close()
			fs.rmSync(tempRoot, { recursive: true, force: true })
		}
	}

	@Scenario("Upstream non-200 status code is passed through by proxy")
	static async upstreamNon200StatusPassThrough(input: object = {}, assert: AssertFn) {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-server-status-"))
		const upstream = await this.startUpstreamServer((_req, res) => {
			res.statusCode = 418
			res.setHeader("content-type", "text/plain; charset=utf-8")
			res.end("teapot")
		})

		try {
			const server = new LlltsServer()
			const config: ServerConfig = {
				projectPath: tempRoot,
				projectClientLink: upstream.url
			}
			const app = server.createApp(config)
			const response = await this.request(app, "/teapot")
			assert(response.status === 418, "Proxy should pass through upstream non-200 status code")
			assert(response.body === "teapot", "Proxy should pass through upstream non-200 response body")
		} finally {
			await upstream.close()
			fs.rmSync(tempRoot, { recursive: true, force: true })
		}
	}
}
