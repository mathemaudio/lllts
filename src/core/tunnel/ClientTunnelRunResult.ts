import type { ClientTunnelRunStatus } from "./ClientTunnelRunStatus"
import { Spec } from "../../public/lll.lll"

Spec("Result payload returned by the client tunnel runner.")
export type ClientTunnelRunResult = {
	status: ClientTunnelRunStatus
	reportText?: string
	reportJson?: unknown
	message?: string
	consoleErrors?: Array<{
		phase: "preflight" | "scenario"
		source: "pageerror" | "console.error"
		text: string
		location?: {
			url?: string
			lineNumber?: number
			columnNumber?: number
		}
	}>
}
