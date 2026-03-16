export type FakeRunnerState = {
	launchHeadless: boolean | null
	contextClosedCount: number
	browserClosedCount: number
	visitedUrl?: string
}
