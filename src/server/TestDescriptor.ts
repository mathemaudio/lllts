import type { ScenarioDescriptor } from "./ScenarioDescriptor"

export type TestDescriptor = {
	path: string
	scenarios: ScenarioDescriptor[]
}
