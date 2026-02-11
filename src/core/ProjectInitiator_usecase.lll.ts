import { Scenario } from "../public/lll.js"
import { Spec } from "../public/lll.js"
import { AssertFn } from "../public/lll.js"
import { ProjectInitiator } from "./ProjectInitiator.lll"

@Spec("Verifies project loading strategies.")
export class ProjectInitiator_usecase {
	environment = "api"

	@Scenario("Load project files")
	static async loadFiles(input = {}, assert: AssertFn) {
		const loader = new ProjectInitiator("./tsconfig.json", "from_imports", "src/examples/TodoExample.lll.ts")
		const files = loader.getFiles()
		assert(files.length > 0, "Should load at least lll file")
	}
}
