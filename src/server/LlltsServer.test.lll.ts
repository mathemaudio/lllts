import * as fs from "fs"
import * as http from "http"
import * as os from "os"
import * as path from "path"
import { AssertFn, Scenario, Spec } from "../public/lll.lll.js"
import { LlltsServer } from "./LlltsServer.lll.js"

@Spec("Unit scenarios for LlltsServer plain-text responses.")
export class LlltsServerTest {
	testType = "unit"

	@Spec("Runs a single request against an ephemeral listener and returns status/body.")
	private static async request(app: ReturnType<LlltsServer["createApp"]>, requestPath: string) {
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
			const response = await fetch(`http://127.0.0.1:${address.port}${requestPath}`)
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

	@Scenario("Missing projectPath returns 400 guidance text")
	static async missingProjectPathResponse(input: object = {}, assert: AssertFn) {
		const server = new LlltsServer()
		const app = server.createApp()
		const response = await this.request(app, "/")
		assert(response.status === 400, "Missing projectPath should return HTTP 400")
		assert(response.contentType.includes("text/plain"), "Missing projectPath should return text/plain")
		const body = response.body
		assert(body.includes("projectPath query parameter is required."), "Response should explain required query")
	}

	@Scenario("Provided projectPath returns folder details and discovered tests")
	static async providedProjectPathResponse(input: object = {}, assert: AssertFn) {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-server-"))
		const nestedDir = path.join(tempRoot, "src", "features")
		const testFileA = path.join(tempRoot, "src", "Alpha.test.lll.ts")
		const testFileB = path.join(nestedDir, "Beta.test.lll.ts")
		fs.mkdirSync(nestedDir, { recursive: true })
		fs.writeFileSync(testFileA, "export class AlphaTest {}\n")
		fs.writeFileSync(testFileB, "export class BetaTest {}\n")

		try {
			const server = new LlltsServer()
			const app = server.createApp()
			const encodedPath = encodeURIComponent(tempRoot)
			const response = await this.request(app, `/?projectPath=${encodedPath}`)
			assert(response.status === 200, "Provided projectPath should return HTTP 200")
			assert(response.contentType.includes("text/plain"), "Provided projectPath should return text/plain")
			const body = response.body
			const expectedName = path.basename(tempRoot)

			assert(body.includes(`Project Name: ${expectedName}`), "Response should include resolved folder name")
			assert(body.includes(`Project Path: ${tempRoot}`), "Response should include resolved absolute path")
			assert(body.includes("Project Exists: true"), "Existing folder should be marked true")
			assert(body.includes("Project Is Directory: true"), "Directory flag should be true")
			assert(body.includes("- src/Alpha.test.lll.ts"), "Top-level test file should be listed")
			assert(body.includes("- src/features/Beta.test.lll.ts"), "Nested test file should be listed")
		} finally {
			fs.rmSync(tempRoot, { recursive: true, force: true })
		}
	}

	@Scenario("Non-existing projectPath reports false flags and no tests")
	static async nonExistingProjectPathResponse(input: object = {}, assert: AssertFn) {
		const server = new LlltsServer()
		const uniquePath = path.join(os.tmpdir(), `lllts-missing-${Date.now()}-${Math.random().toString(16).slice(2)}`)
		const app = server.createApp()
		const response = await this.request(app, `/?projectPath=${encodeURIComponent(uniquePath)}`)
		const body = response.body

		assert(response.status === 200, "Provided query should return HTTP 200 even when path does not exist")
		assert(body.includes("Project Exists: false"), "Non-existing path should report exists false")
		assert(body.includes("Project Is Directory: false"), "Non-existing path should report directory false")
		assert(body.includes("- (none found)"), "Missing path should produce no tests line")
	}
}
