import type { BehavioralTestReference } from "./references/BehavioralTestReference"

export type TestInventorySummary = {
	hasBehavioralTests: boolean
	behavioralTests: BehavioralTestReference[]
}
