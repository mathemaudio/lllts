import type { BrowserType, Page } from "playwright"
import { AssertFn, Scenario, Spec } from "../../public/lll.lll"
import type { FakeRunnerOptions } from "../FakeRunnerOptions"
import type { FakeRunnerState } from "../FakeRunnerState"
import "./ClientTunnelRunner.lll"
import { ClientTunnelRunner } from "./ClientTunnelRunner.lll"

@Spec("Unit coverage for client tunnel browser execution and status mapping.")
export class ClientTunnelRunnerTest {
	testType = "unit"

	@Spec("Creates a runner backed by mocked Playwright objects for deterministic testing.")
	private static createRunner(options: FakeRunnerOptions = {}): { runner: ClientTunnelRunner; state: FakeRunnerState } {
		const state: FakeRunnerState = {
			launchHeadless: null,
			contextClosedCount: 0,
			browserClosedCount: 0,
			visitedUrl: ""
		}

		let evaluateCount = 0
		const page = {
			goto: async function goto(url: string, _gotoOptions?: Parameters<Page["goto"]>[1]) {
				state.visitedUrl = url
				if (options.gotoError !== undefined) {
					throw options.gotoError
				}
			},
			waitForFunction: async function waitForFunction(
				_predicate: Parameters<Page["waitForFunction"]>[0],
				_waitOptions?: Parameters<Page["waitForFunction"]>[1]
			) {
				if (options.waitError !== undefined) {
					throw options.waitError
				}
			},
			evaluate: async function evaluate<T>(_fn: Parameters<Page["evaluate"]>[0]) {
				evaluateCount++
				if (evaluateCount === 1) {
					return (options.reportText ?? "All client behavioral tests passed") as T
				}
				return options.reportJson as T
			}
		}

		const context = {
			newPage: async function newPage() {
				return page
			},
			close: async function close() {
				state.contextClosedCount++
			}
		}

		const browser = {
			newContext: async function newContext() {
				return context
			},
			close: async function close() {
				state.browserClosedCount++
			}
		}

		const runner = new ClientTunnelRunner(() => ({
			chromium: {
				launch: async function launch(launchOptions?: Parameters<BrowserType["launch"]>[0]) {
					if (options.launchError !== undefined) {
						throw options.launchError
					}
					state.launchHeadless = launchOptions?.headless ?? true
					return browser
				}
			}
		}))

		return { runner, state }
	}

	@Scenario("Passes when final report line does not contain failed")
	static async passesWhenLastLineIsClientBehavioralPassed(input: object = {}, assert: AssertFn) {
		const fixture = this.createRunner({
			reportText: "## src/App.test.lll.ts\n- scenario one: passed\n\nAll client behavioral tests passed"
		})
		const result = await fixture.runner.run({ url: "http://localhost:3000", headed: false, timeoutMs: 60000 })
		assert(result.status === "passed", "Expected tunnel result to pass when report ends with client behavioral pass summary")
		assert(fixture.state.launchHeadless === true, "Runner should launch headless browser when headed=false")
		assert(fixture.state.contextClosedCount === 1, "Runner should close context after run")
		assert(fixture.state.browserClosedCount === 1, "Runner should close browser after run")
	}

	@Scenario("Fails when final report line contains failed case-insensitively")
	static async failsWhenLastLineContainsFailed(input: object = {}, assert: AssertFn) {
		const fixture = this.createRunner({
			reportText: "## src/App.test.lll.ts\n⛔️ scenario one: failed: nope\n\nSome Failed"
		})
		const result = await fixture.runner.run({ url: "http://localhost:3000", headed: false, timeoutMs: 60000 })
		assert(result.status === "failed", "Expected tunnel result to fail when report ends with failed")
		assert(!!result.reportText && result.reportText.includes("Some Failed"), "Expected failed run to include report text")
	}

	@Scenario("Returns timeout when waitForFunction times out")
	static async returnsTimeoutStatus(input: object = {}, assert: AssertFn) {
		const timeoutError = new Error("wait timed out")
		timeoutError.name = "TimeoutError"
		const fixture = this.createRunner({ waitError: timeoutError })
		const result = await fixture.runner.run({ url: "http://localhost:3000", headed: false, timeoutMs: 500 })
		assert(result.status === "timeout", "Expected TimeoutError to map to timeout status")
		assert(fixture.state.contextClosedCount === 1, "Timeout run should close context")
		assert(fixture.state.browserClosedCount === 1, "Timeout run should close browser")
	}

	@Scenario("Returns runtime_error when browser navigation throws")
	static async returnsRuntimeError(input: object = {}, assert: AssertFn) {
		const fixture = this.createRunner({ gotoError: new Error("navigation failed") })
		const result = await fixture.runner.run({ url: "http://localhost:3000", headed: true, timeoutMs: 60000 })
		assert(result.status === "runtime_error", "Non-timeout runtime exceptions should map to runtime_error")
		assert(fixture.state.launchHeadless === false, "Runner should launch headed browser when headed=true")
	}

	@Scenario("Includes JSON mirror payload when report JSON exists")
	static async includesJsonMirror(input: object = {}, assert: AssertFn) {
		const reportJson = {
			status: "passed",
			summary: { totalTests: 1, passedScenarios: 2, failedScenarios: 0 }
		}
		const fixture = this.createRunner({
			reportText: "## src/App.test.lll.ts\n- scenario one: passed\n\nAll client behavioral tests passed",
			reportJson
		})
		const result = await fixture.runner.run({ url: "http://localhost:3000", headed: false, timeoutMs: 60000 })
		assert(result.status === "passed", "Expected report with client behavioral pass summary to map to passed status")
		assert(!!result.reportJson && typeof result.reportJson === "object", "Expected JSON mirror to be returned when present")
		const summary = (result.reportJson as { summary?: { totalTests?: number } }).summary
		assert(!!summary && summary.totalTests === 1, "Expected JSON mirror summary to preserve totalTests")
	}

	@Scenario("Appends automatic=true to tunnel URL before browser navigation")
	static async appendsAutomaticQueryParam(input: object = {}, assert: AssertFn) {
		const fixture = this.createRunner()
		await fixture.runner.run({ url: "http://localhost:3000/tunnel", headed: false, timeoutMs: 60000 })
		assert(
			fixture.state.visitedUrl === "http://localhost:3000/tunnel?automatic=true",
			"Expected tunnel runner to append automatic=true when query string is absent"
		)
	}

	@Scenario("Preserves existing tunnel query parameters when adding automatic=true")
	static async preservesExistingQueryParams(input: object = {}, assert: AssertFn) {
		const fixture = this.createRunner()
		await fixture.runner.run({ url: "http://localhost:3000/tunnel?foo=bar", headed: false, timeoutMs: 60000 })
		assert(
			fixture.state.visitedUrl === "http://localhost:3000/tunnel?foo=bar&automatic=true",
			"Expected tunnel runner to preserve existing query params when adding automatic=true"
		)
	}
}
