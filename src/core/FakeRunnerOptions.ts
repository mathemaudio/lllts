import type { ClientTunnelRunResult } from "./tunnel/ClientTunnelRunResult"

export type FakeRunnerOptions = {
	reportText?: string
	reportJson?: unknown
	gotoError?: Error
	waitError?: Error
	launchError?: Error
	preflightConsoleErrors?: NonNullable<ClientTunnelRunResult["consoleErrors"]>
	scenarioConsoleErrors?: NonNullable<ClientTunnelRunResult["consoleErrors"]>
	consoleWarnings?: string[]
}
