import { AssertFn, Scenario, Spec } from "../../public/lll.lll.js"
import { ProjectInitiator } from "../ProjectInitiator.lll.js"
import "./RulesEngine.lll"
import { RulesEngine } from "./RulesEngine.lll.js"

@Spec("Runs registered rules over the project graph.")
export class RulesEngineTest {
	testType = "unit"

	@Scenario("Run rules on project")
	static async runRules(input: object = {}, assert: AssertFn) {
		const loader = new ProjectInitiator("./tsconfig.json", "from_imports", "src/LLLTS.lll.ts")
		const engine = new RulesEngine(loader)
		const results = engine.runAll()
		assert(Array.isArray(results), "Results should be an array")
		assert(results.length >= 0, "Diagnostics count should be numeric")
	}
}
