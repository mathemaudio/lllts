import { LLLTS } from "./LLLTS.lll.js";
import { AssertFn, Scenario, Spec } from "./public/lll.lll.js";

@Spec("End-to-end scenarios for the LLLTS CLI.")
export class LLLTSTest {
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

		const exitCode = await LLLTS.main(args)
		assert(typeof exitCode === "number", "Compiler should return an exit code")
		console.log("Playground run", { project, entry, verbose, exitCode })
	}
}
