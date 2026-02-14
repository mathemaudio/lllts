import { Scenario } from "./public/lll.lll.js";
import { Spec } from "./public/lll.lll.js";
import { AssertFn } from "./public/lll.lll.js";
import { LllTsc } from "./LllTsc.lll"

@Spec("End-to-end scenarios for the LLLTS CLI.")
export class LllTscTest {
	testType = "unit"

	@Scenario("Compile MathObject example using the playground inputs")
	static async compileMathObjectExample(input: { project?: string; entry?: string; verbose?: boolean } = {}, assert: AssertFn) {
		const project = (input.project || "./tsconfig.json").trim()
		const entry = (input.entry || "src/examples/MathObject.lll.ts").trim()
		const verbose = input.verbose ?? false

		const args = ["--project", project, "--entry", entry]
		if (verbose) {
			args.push("--verbose")
		}

		const exitCode = await LllTsc.main(args)
		assert(typeof exitCode === "number", "Compiler should return an exit code")
		console.log("Playground run", { project, entry, verbose, exitCode })
	}
}
