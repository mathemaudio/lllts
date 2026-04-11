import { Project } from "ts-morph"
import { AssertFn, Scenario, Spec, WaitForFn, ScenarioParameter } from "../../public/lll.lll"
import "./NoRogueTopLevelRule.lll"
import { NoRogueTopLevelRule } from "./NoRogueTopLevelRule.lll"

@Spec("Validates no-rogue-top-level constraints.")
export class NoRogueTopLevelRuleTest {
	testType = "unit"

	@Spec("Runs NoRogueTopLevelRule on an in-memory source file.")
	private static runRuleOn(filePath: string, body: string): import('../../core/DiagnosticObject').DiagnosticObject[] {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(filePath, body)
		return NoRogueTopLevelRule.getRule().run(sourceFile)
	}

	@Scenario("Passes class-only file")
	static async passesClassOnlyFile(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {}`
		)
		assert(diagnostics.length === 0, "Expected class-only file to pass")
	}

	@Scenario("Rejects top-level function")
	static async rejectsTopLevelFunction(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`function helper() { return 1 }
export class MathObject {}`
		)
		assert(diagnostics.some(d => d.ruleCode === "rogue-top-level"), "Expected rogue-top-level for function")
	}

	@Scenario("Rejects top-level variables")
	static async rejectsTopLevelVariables(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`const X = 1
let y = 2
var z = 3
export class MathObject {}`
		)
		assert(diagnostics.length >= 3, "Expected rogue-top-level diagnostics for const/let/var")
	}

	@Scenario("Rejects top-level enum")
	static async rejectsTopLevelEnum(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`enum Greeting { Hi = "hi" }
export class MathObject {}`
		)
		assert(diagnostics.some(d => d.message.includes("enum")), "Expected enum diagnostic")
	}

	@Scenario("Rejects top-level namespace")
	static async rejectsTopLevelNamespace(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`namespace Internal { export const value = 1 }
export class MathObject {}`
		)
		assert(diagnostics.some(d => d.message.includes("namespace/module")), "Expected namespace/module diagnostic")
	}

	@Scenario("Rejects top-level declare in ts")
	static async rejectsTopLevelDeclareInTs(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`declare class AmbientThing {}
export class MathObject {}`
		)
		assert(diagnostics.some(d => d.message.includes("declare")), "Expected declare diagnostic in .ts")
	}

	@Scenario("Allows declaration files")
	static async allowsDeclarationFiles(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/globals.d.ts",
			`declare const ambientValue: string`
		)
		assert(diagnostics.length === 0, "Expected .d.ts file to be excluded")
	}

	@Scenario("Allows pure re-export barrels")
	static async allowsPureReExportBarrels(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/public/index.ts",
			`export * from "./api"
export { A } from "./A"`
		)
		assert(diagnostics.length === 0, "Expected pure re-export barrel to pass")
	}

	@Scenario("Allows one final top-level if")
	static async allowsOneFinalTopLevelIf(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/LLLTS.lll.ts",
			`export class LLLTS {}
if (true) { console.log("x") }`
		)
		assert(diagnostics.length === 0, "Expected single final top-level if to pass")
	}

	@Scenario("Allows one final top-level new of exported class in production file")
	static async allowsFinalTopLevelNewOfExportedClass(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/Start.lll.ts",
			`export class Start {}
new Start()`
		)
		assert(diagnostics.length === 0, "Expected final new exported-class instantiation to pass in production file")
	}

	@Scenario("Rejects top-level new in test files")
	static async rejectsTopLevelNewInTestFile(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/Start.test.lll.ts",
			`export class StartTest {}
new StartTest()`
		)
		assert(diagnostics.some(d => d.message.includes("forbidden in test files")), "Expected top-level new to fail in tests")
	}

	@Scenario("Rejects multiple top-level if statements")
	static async rejectsMultipleTopLevelIf(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/LLLTS.lll.ts",
			`export class LLLTS {}
if (true) {}
if (false) {}`
		)
		assert(diagnostics.some(d => d.message.includes("Only one top-level if")), "Expected multiple if diagnostic")
	}

	@Scenario("Rejects non-final top-level if")
	static async rejectsNonFinalTopLevelIf(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/LLLTS.lll.ts",
			`if (true) {}
export class LLLTS {}`
		)
		assert(diagnostics.some(d => d.message.includes("must be the last")), "Expected final-if placement diagnostic")
	}

	@Scenario("Allows explicit public decorators file exception")
	static async allowsPublicDecoratorsException(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/public/lll.lll.ts",
			`export function Spec() {}
export function Scenario() {}`
		)
		assert(diagnostics.length === 0, "Expected lll.lll.ts to be an explicit exception")
	}

	@Scenario("Allows top-level Spec call immediately before exported type")
	static async allowsTopLevelSpecBeforeExportedType(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const diagnostics = NoRogueTopLevelRuleTest.runRuleOn(
			"/src/ProjectReport.ts",
			`Spec("project report")
export type ProjectReport = { value: string }`
		)
		assert(diagnostics.length === 0, "Expected top-level Spec before exported type to pass")
	}
}
