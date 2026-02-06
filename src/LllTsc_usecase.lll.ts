import { Spec, Scenario } from "./public/decorators.js"
import { AssertFn } from "./public/AssertFn.lll"
import { LllTsc } from "./LllTsc.lll"

@Spec("End-to-end scenarios for the LLLTS CLI.")
export class LllTsc_usecase {
	environment = "api"

	@Scenario("Compile Todo example using the playground inputs")
	static async compileTodoExample(input: { project?: string; entry?: string; verbose?: boolean } = {}, assert: AssertFn) {
		const project = (input.project || "./tsconfig.json").trim()
		const entry = (input.entry || "src/examples/TodoExample.lll.ts").trim()
		const verbose = input.verbose ?? false

		const args = ["--project", project, "--entry", entry]
		if (verbose) {
			args.push("--verbose")
		}

		const exitCode = await LllTsc.main(args)
		assert(exitCode === 0, "Todo example should compile successfully")
		console.log("Playground run", { project, entry, verbose, exitCode })
	}
}
