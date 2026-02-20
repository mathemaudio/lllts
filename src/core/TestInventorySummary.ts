import type { BehavioralTestReference } from "./BehavioralTestReference"

export type TestInventorySummary = {
	hasBehavioralTests: boolean
	behavioralTests: BehavioralTestReference[]
}
