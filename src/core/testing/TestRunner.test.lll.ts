import * as path from "path"
import { AssertFn, Scenario, Spec } from "../../public/lll.lll.js"
import { ProjectInitiator } from "../ProjectInitiator.lll.js"
import "./TestRunner.lll"
import { TestRunner } from "./TestRunner.lll.js"
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

	@Scenario("Resolves compiled test output using the inferred common source directory")
	static async resolvesCompiledPathWithoutExplicitRootDir(input: object = {}, assert: AssertFn) {
		const tsconfigPath = path.resolve("test-fixtures/test-runner-multi-root/client/tsconfig.json")
		const loader = new ProjectInitiator(tsconfigPath, "from_folder")
		const runner = new TestRunner(loader, tsconfigPath)
		const sourcePath = path.resolve("test-fixtures/test-runner-multi-root/client/src/Widget.test.lll.ts")
		const compiledPath = (runner as unknown as { getCompiledPath: (filePath: string) => string | null }).getCompiledPath(sourcePath)
		const expectedPath = path.resolve("test-fixtures/test-runner-multi-root/client/dist/client/src/Widget.test.lll.js")
		assert(compiledPath === expectedPath, `Expected compiled path '${expectedPath}', got '${compiledPath ?? "null"}'`)
	}
}
