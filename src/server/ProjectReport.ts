import { Spec } from "../public/lll.lll"
import type { ScenarioDescriptor } from "./ScenarioDescriptor"


export type ProjectReport = {
	projectName: string
	projectPath: string
	exists: boolean
	isDirectory: boolean
	testFiles: string[]
	testScenarios: Record<string, ScenarioDescriptor[]>
}
