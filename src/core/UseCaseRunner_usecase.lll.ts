import { Spec, Scenario } from "../public/decorators.js"
import { AssertFn } from "../public/AssertFn.lll"
import { UseCaseRunner } from "./UseCaseRunner.lll"
import { ProjectInitiator } from "./ProjectInitiator.lll"

@Spec("Smoke tests for the scenario execution pipeline.")
export class UseCaseRunner_usecase {
	environment = "api"

	@Scenario("Update DOM snapshot")
	static async updateDom(input: object = {}, assert: AssertFn) {
		const loader = new ProjectInitiator("./tsconfig.json", "from_imports", "src/examples/TodoExample.lll.ts")
		const runner = new UseCaseRunner(loader, "./tsconfig.json")
		const result = await runner.runAll()
		assert(Array.isArray(result.diagnostics), "Diagnostics should be an array")
	}
}
