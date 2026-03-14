import { Scenario } from "../../public/lll.lll.js"
import { Spec } from "../../public/lll.lll.js"
import { AssertFn } from "../../public/lll.lll.js"
import { TestRunner } from "./TestRunner.lll.js"
import { ProjectInitiator } from "../ProjectInitiator.lll.js"
@Spec("Smoke tests for the scenario execution pipeline.")
export class TestRunnerTest {
	testType = "unit"

	@Scenario("Update DOM snapshot")
	static async updateDom(input: object = {}, assert: AssertFn) {
		const loader = new ProjectInitiator("./tsconfig.json", "from_imports", "src/examples/MathObject.lll.ts")
		const runner = new TestRunner(loader, "./tsconfig.json")
		const result = await runner.runAll()
		assert(Array.isArray(result.diagnostics), "Diagnostics should be an array")
	}
}
