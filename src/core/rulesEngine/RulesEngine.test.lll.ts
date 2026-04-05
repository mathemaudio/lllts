import * as fs from "fs"
import * as os from "os"
import * as path from "path"
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

	@Scenario("Fail-safe mode requires second companions and suppresses coverage debt")
	static async failSafeModeRequiresSecondCompanion(input: object = {}, assert: AssertFn) {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-fail-safe-rules-"))

		try {
			const srcDir = path.join(tempRoot, "src")
			fs.mkdirSync(srcDir, { recursive: true })
			fs.writeFileSync(
				path.join(tempRoot, "tsconfig.json"),
				JSON.stringify({
					compilerOptions: {
						target: "ES2022",
						module: "CommonJS",
						moduleResolution: "Node",
						experimentalDecorators: true
					},
					include: ["src/**/*"]
				})
			)
			fs.writeFileSync(
				path.join(srcDir, "Main.lll.ts"),
				`
import { Spec } from "../../src/public/lll.lll.js"
@Spec("main")
export class Main {
	@Spec("touch")
	public static touch(): void {}
}
`
			)
			fs.writeFileSync(
				path.join(srcDir, "Main.test.lll.ts"),
				`
import "./Main.lll"
import { Scenario, Spec } from "../../src/public/lll.lll.js"
@Spec("test")
export class MainTest {
	testType = "unit"
	@Scenario("s")
	static async s() {}
}
`
			)

			const loader = new ProjectInitiator(path.join(tempRoot, "tsconfig.json"), "from_imports", "src/Main.lll.ts")
			const engine = new RulesEngine(loader)
			const failSafeResults = engine.runAll({ failSafeMode: true })
			assert(
				failSafeResults.some(result => result.message.includes("Main.test2.lll.ts")),
				"Expected fail-safe mode to require the second companion file"
			)
			assert(
				!failSafeResults.some(result => result.ruleCode === "test-coverage"),
				"Expected fail-safe mode to suppress coverage debt diagnostics"
			)
		} finally {
			fs.rmSync(tempRoot, { recursive: true, force: true })
		}
	}
}
