import { Scenario } from "../public/lll.lll.js"
import { Spec } from "../public/lll.lll.js"
import { AssertFn } from "../public/lll.lll.js"
import { ProjectInitiator } from "./ProjectInitiator.lll"
import { RulesEngine } from "./RulesEngine.lll"

@Spec("Runs registered rules over the project graph.")
export class RulesEngineTestosterone {
	testType = "unit"

	@Scenario("Run rules on project")
	static async runRules(input: object = {}, assert: AssertFn) {
		const loader = new ProjectInitiator("./tsconfig.json", "from_imports", "src/LllTsc.lll.ts")
		const engine = new RulesEngine(loader)
		const results = engine.runAll()
		assert(Array.isArray(results), "Results should be an array")
		assert(results.length >= 0, "Diagnostics count should be numeric")
	}
}
