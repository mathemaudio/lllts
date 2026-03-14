import { Out } from "../../public/lll.lll"
import { Spec } from "../../public/lll.lll"
import * as util from "util"
import type { Browser } from "playwright"
import type { BrowserContext } from "playwright"
import type { BrowserType } from "playwright"
import type { Page } from "playwright"
import type { ClientTunnelRunInput } from "./ClientTunnelRunInput"
import type { ClientTunnelRunResult } from "./ClientTunnelRunResult"

@Spec("Runs behavioral scenarios through the overlay UI using a Playwright browser tunnel.")
export class ClientTunnelRunner {
	constructor(
		private readonly loadPlaywright: () => {
			chromium: {
				launch: (...args: Parameters<BrowserType["launch"]>) => Promise<{
					newContext: (...args: Parameters<Browser["newContext"]>) => Promise<{
						newPage: (...args: Parameters<BrowserContext["newPage"]>) => Promise<{
							goto: (...args: Parameters<Page["goto"]>) => Promise<unknown>
							waitForFunction: (...args: Parameters<Page["waitForFunction"]>) => Promise<unknown>
							evaluate: <T>(...args: Parameters<Page["evaluate"]>) => Promise<T>
						}>
						close: BrowserContext["close"]
					}>
					close: Browser["close"]
				}>
			}
		} = () => require("playwright") as typeof import("playwright")
	) {
		Spec("Initializes client tunnel runner with injectable playwright loader.")
	}

	@Spec("Launches browser, waits for the fixed report variable, and returns parsed behavioral status.")
	@Out("result", "ClientTunnelRunResult")
	public async run(input: ClientTunnelRunInput): Promise<ClientTunnelRunResult> {
		let browser: {
			newContext: (...args: Parameters<Browser["newContext"]>) => Promise<{
				newPage: (...args: Parameters<BrowserContext["newPage"]>) => Promise<{
					goto: (...args: Parameters<Page["goto"]>) => Promise<unknown>
					waitForFunction: (...args: Parameters<Page["waitForFunction"]>) => Promise<unknown>
					evaluate: <T>(...args: Parameters<Page["evaluate"]>) => Promise<T>
				}>
				close: BrowserContext["close"]
			}>
			close: Browser["close"]
		} | null = null
		let context: {
			newPage: (...args: Parameters<BrowserContext["newPage"]>) => Promise<{
				goto: (...args: Parameters<Page["goto"]>) => Promise<unknown>
				waitForFunction: (...args: Parameters<Page["waitForFunction"]>) => Promise<unknown>
				evaluate: <T>(...args: Parameters<Page["evaluate"]>) => Promise<T>
			}>
			close: BrowserContext["close"]
		} | null = null
		try {
			const playwright = this.loadPlaywright()
			if (!playwright.chromium || typeof playwright.chromium.launch !== "function") {
				return {
					status: "runtime_error",
					message: "Playwright chromium launcher is unavailable. Install 'playwright' and retry."
				}
			}

			const browserInstance = await playwright.chromium.launch({ headless: !input.headed })
			browser = browserInstance
			context = await browserInstance.newContext()
			const page = await context.newPage()

			await page.goto(input.url, { waitUntil: "domcontentloaded" })
			await page.waitForFunction(
				() => typeof (globalThis as typeof globalThis & { FIXED_llltsLastRunReport?: unknown }).FIXED_llltsLastRunReport === "string",
				{ timeout: input.timeoutMs }
			)

			const reportTextRaw = await page.evaluate(
				() => (globalThis as typeof globalThis & { FIXED_llltsLastRunReport?: unknown }).FIXED_llltsLastRunReport
			)
			const reportJson = await page.evaluate(
				() => (globalThis as typeof globalThis & { FIXED_llltsLastRunReportJson?: unknown }).FIXED_llltsLastRunReportJson
			)
			const reportText = typeof reportTextRaw === "string" ? reportTextRaw : String(reportTextRaw ?? "")

			return {
				status: this.reportIndicatesFailure(reportText) ? "failed" : "passed",
				reportText,
				reportJson
			}
		} catch (error) {
			return this.mapRuntimeError(error)
		} finally {
			await this.safeClose(context)
			await this.safeClose(browser)
		}
	}

	@Spec("Returns true when the final report line indicates a failed run.")
	@Out("failed", "boolean")
	private reportIndicatesFailure(reportText: string): boolean {
		const lines = String(reportText || "")
			.split(/\r?\n/)
			.map(line => line.trim())
			.filter(line => line.length > 0)
		const lastLine = lines.length > 0 ? lines[lines.length - 1] : ""
		return /failed/i.test(lastLine)
	}

	@Spec("Maps browser/runtime errors into deterministic tunnel statuses.")
	@Out("result", "ClientTunnelRunResult")
	private mapRuntimeError(error: unknown): ClientTunnelRunResult {
		const message = this.formatError(error)
		if (this.isTimeoutError(error)) {
			return {
				status: "timeout",
				message
			}
		}
		return {
			status: "runtime_error",
			message
		}
	}

	@Spec("Returns true when an error originates from a timeout boundary.")
	@Out("isTimeout", "boolean")
	private isTimeoutError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return false
		}
		return error.name === "TimeoutError" || /timeout/i.test(error.message)
	}

	@Spec("Converts unknown errors into readable text.")
	@Out("text", "string")
	private formatError(error: unknown): string {
		if (error instanceof Error) {
			return error.stack ?? error.message ?? String(error)
		}
		if (typeof error === "string") {
			return error
		}
		return util.inspect(error, { depth: 4, colors: false })
	}

	@Spec("Safely closes playwright resources without masking primary failures.")
	private async safeClose(target: { close(): Promise<void> | void } | null) {
		if (!target || typeof target.close !== "function") {
			return
		}
		try {
			await target.close()
		} catch {
			// Ignore close failures from teardown paths.
		}
	}
}
