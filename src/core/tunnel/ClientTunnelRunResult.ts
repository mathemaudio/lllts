import type { ClientTunnelRunStatus } from "./ClientTunnelRunStatus";

export type ClientTunnelRunResult = {
	status: ClientTunnelRunStatus
	reportText?: string;
	reportJson?: unknown
	message?: string
}
