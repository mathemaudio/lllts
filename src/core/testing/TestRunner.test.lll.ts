import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { AssertFn, Scenario, Spec, WaitForFn } from "../../public/lll.lll.js"
import { ProjectInitiator } from "../ProjectInitiator.lll.js"
import "./TestRunner.lll"
import { TestRunner } from "./TestRunner.lll.js"
@Spec("Smoke tests for the scenario execution pipeline.")
export class TestRunnerTest {
	testType = "unit"

	@Scenario("Update DOM snapshot")
	static async updateDom(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const loader = new ProjectInitiator("./tsconfig.json", "from_imports", "src/examples/MathObject.lll.ts")
		const runner = new TestRunner(loader, "./tsconfig.json")
		const result = await runner.runAll()
		assert(Array.isArray(result.diagnostics), "Diagnostics should be an array")
	}

	@Scenario("Resolves compiled test output using the inferred common source directory")
	static async resolvesCompiledPathWithoutExplicitRootDir(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const tsconfigPath = path.resolve("test-fixtures/test-runner-multi-root/client/tsconfig.json")
		const loader = new ProjectInitiator(tsconfigPath, "from_folder")
		const runner = new TestRunner(loader, tsconfigPath)
		const sourcePath = path.resolve("test-fixtures/test-runner-multi-root/client/src/Widget.test.lll.ts")
		const compiledPath = (runner as unknown as { getCompiledPath: (filePath: string) => string | null }).getCompiledPath(sourcePath)
		const expectedPath = path.resolve("test-fixtures/test-runner-multi-root/client/dist/client/src/Widget.test.lll.js")
		assert(compiledPath === expectedPath, `Expected compiled path '${expectedPath}', got '${compiledPath ?? "null"}'`)
	}

	@Scenario("Summarizes behavioral inventory from second companion files")
	static async summarizesBehavioralInventoryFromSecondCompanion(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-test-runner-test2-"))

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
			fs.writeFileSync(path.join(srcDir, "App.lll.ts"), "export class App {}\n")
			fs.writeFileSync(
				path.join(srcDir, "App.test2.lll.ts"),
				`
import "./App.lll"
export class AppTest2 extends LitElement {
	testType = "behavioral"
	static styles: string = ""
	render(): string {
		return ""
	}
	@Scenario("render")
	static async renderScenario() {}
}
`
			)

			const loader = new ProjectInitiator(path.join(tempRoot, "tsconfig.json"), "from_imports", "src/App.lll.ts")
			const runner = new TestRunner(loader, path.join(tempRoot, "tsconfig.json"))
			const summary = runner.summarizeInventory()
			assert(summary.hasBehavioralTests, "Expected second behavioral companion to appear in inventory")
			assert(summary.behavioralTests.length === 1, "Expected one behavioral second companion")
			assert(summary.behavioralTests[0].className === "AppTest2", "Expected second companion class name to be reported")
			assert(summary.behavioralTests[0].filePath === "src/App.test2.lll.ts", "Expected second companion file path to be reported")
		} finally {
			fs.rmSync(tempRoot, { recursive: true, force: true })
		}
	}

	@Scenario("Passes default input and waitFor helper into unit scenarios")
	static async passesDefaultInputAndWaitForHelperToUnitScenarios(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const runner = new TestRunner(new ProjectInitiator("./tsconfig.json", "from_imports", "src/examples/MathObject.lll.ts"), "./tsconfig.json")
		let receivedInput: object | null = null
		let receivedWaitForType = "missing"
		let waitChecks = 0

		const runtimeClass = {
			async acceptsRuntimeHelpers(scenarioInput: object, scenarioAssert: AssertFn, waitFor: (predicate: () => boolean, message: string, timeoutMs?: number, intervalMs?: number) => Promise<void>) {
				receivedInput = scenarioInput
				receivedWaitForType = typeof waitFor
				await waitFor(() => {
					waitChecks += 1
					return waitChecks > 1
				}, "Expected helper to retry until condition passed", 50, 1)
				scenarioAssert(waitChecks > 1, "Expected waitFor to poll until condition passed")
			}
		}

		const diagnostic = await (runner as unknown as {
			runScenarioUnit: (context: { scenarioMethodName: string; className: string; scenarioName: string; filePath: string; line: number }, runtimeClass: Record<string, unknown>) => Promise<unknown>
		}).runScenarioUnit(
			{
				scenarioMethodName: "acceptsRuntimeHelpers",
				className: "RuntimeHelpersTest",
				scenarioName: "acceptsRuntimeHelpers",
				filePath: "src/RuntimeHelpers.test.lll.ts",
				line: 1
			},
			runtimeClass
		)

		assert(diagnostic === null, "Expected unit scenario helper injection to succeed")
		assert(receivedInput !== null, "Expected scenario input to default to an object")
		assert(receivedWaitForType === "function", "Expected waitFor helper to be passed as the third argument")
		assert(waitChecks > 1, "Expected waitFor to retry before succeeding")
	}

	@Scenario("Reports waitFor timeout message from unit scenarios")
	static async reportsWaitForTimeoutMessageFromUnitScenarios(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const runner = new TestRunner(new ProjectInitiator("./tsconfig.json", "from_imports", "src/examples/MathObject.lll.ts"), "./tsconfig.json")

		const runtimeClass = {
			async timesOut(scenarioInput: object, scenarioAssert: AssertFn, waitFor: (predicate: () => boolean, message: string, timeoutMs?: number, intervalMs?: number) => Promise<void>) {
				scenarioAssert(typeof scenarioInput === "object", "Expected scenario input object")
				await waitFor(() => false, "custom timeout context", 15, 1)
			}
		}

		const diagnostic = await (runner as unknown as {
			runScenarioUnit: (context: { scenarioMethodName: string; className: string; scenarioName: string; filePath: string; line: number }, runtimeClass: Record<string, unknown>) => Promise<{ message: string } | null>
		}).runScenarioUnit(
			{
				scenarioMethodName: "timesOut",
				className: "RuntimeHelpersTest",
				scenarioName: "timesOut",
				filePath: "src/RuntimeHelpers.test.lll.ts",
				line: 1
			},
			runtimeClass
		)

		assert(diagnostic !== null, "Expected waitFor timeout to produce a diagnostic")
		assert(diagnostic.message.includes("Condition was not met within 15ms: custom timeout context"), "Expected waitFor timeout message to include custom context")
	}
}
