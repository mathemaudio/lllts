import type { MethodDeclaration } from "ts-morph"
import type { ScenarioMetadata } from "./ScenarioMetadata"

export type ScenarioEntry = {
	method: MethodDeclaration
	metadata: ScenarioMetadata
}
