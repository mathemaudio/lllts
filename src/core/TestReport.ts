import type { ScenarioReport } from "./ScenarioReport"

export type TestReport = {
	className: string
	filePath: string
	line: number
	scenarios: ScenarioReport[]
}
