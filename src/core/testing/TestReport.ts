import type { ScenarioReport } from "../scenario/ScenarioReport"

export type TestReport = {
	className: string
	filePath: string
	line: number
	scenarios: ScenarioReport[]
}
