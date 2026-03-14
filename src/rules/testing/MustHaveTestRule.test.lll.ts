import { AssertFn } from "../../public/lll.lll"
import { Out } from "../../public/lll.lll"
import { Scenario } from "../../public/lll.lll"
import { Spec } from "../../public/lll.lll"
import { MustHaveTestRule } from "./MustHaveTestRule.lll"
import { Project, SourceFile } from "ts-morph"

@Spec("Ensures the rule validates companion classes and schema.")
export class MustHaveTestRuleTest {
	testType = "unit"

	@Spec("Builds an in-memory source file for rule testing.")
	@Out("sourceFile", "SourceFile")
	private static buildSource(project: Project, filePath: string, body: string): SourceFile {
		return project.createSourceFile(filePath, body)
	}

	@Spec("Runs the rule against one in-memory source file.")
	@Out("diagnostics", "import('../../core/DiagnosticObject').DiagnosticObject[]")
	private static runRuleOn(filePath: string, source: string, supportFiles: Record<string, string> = {}) {
		const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { experimentalDecorators: true } })
		for (const [supportPath, supportBody] of Object.entries(supportFiles)) {
			MustHaveTestRuleTest.buildSource(project, supportPath, supportBody)
		}
		const sourceFile = MustHaveTestRuleTest.buildSource(project, filePath, source)
		return MustHaveTestRule.getRule().run(sourceFile)
	}

	@Scenario("Accept valid <Base>.test.lll.ts naming with <Base>Test and host import/use")
	static async acceptsValidTestNaming(input: object = {}, assert: AssertFn) {
		const diagnostics = MustHaveTestRuleTest.runRuleOn(
			"/src/MathObject.test.lll.ts",
			`
import { MathObject } from "./MathObject.lll"
export class MathObjectTest {
	testType = "unit"
	@Scenario("s")
	static async s(input = {}, assert: AssertFn) {
		assert(!!MathObject, "host class should be available")
	}
}
`,
			{
				"/src/MathObject.lll.ts": `export class MathObject { static add(a: number, b: number) { return a + b } }`
			}
		)
		assert(diagnostics.length === 0, "Expected valid test naming to pass MustHaveTestRule")
	}

	@Scenario("Reject invalid test class naming")
	static async rejectsInvalidTestClassNaming(input: object = {}, assert: AssertFn) {
		const diagnostics = MustHaveTestRuleTest.runRuleOn(
			"/src/MathObject.test.lll.ts",
			`
import { MathObject } from "./MathObject.lll"
export class WrongName {
	testType = "unit"
	@Scenario("s")
	static async s(input = {}, assert: AssertFn) {
		assert(!!MathObject, "host class should be available")
	}
}
`,
			{
				"/src/MathObject.lll.ts": `export class MathObject {}`
			}
		)
		assert(diagnostics.some(d => d.ruleCode === "missing-test"), "Expected missing-test for invalid class naming")
	}

	@Scenario("Reject production import from test module")
	static async rejectsProductionImportFromTest(input: object = {}, assert: AssertFn) {
		const diagnostics = MustHaveTestRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`
import { MathObjectTest } from "./MathObject.test.lll"
export class MathObject {
	static touch() {
		return MathObjectTest
	}
}
`,
			{
				"/src/MathObject.test.lll.ts": `export class MathObjectTest {}`
			}
		)
		assert(diagnostics.some(d => d.ruleCode === "test-import-boundary"), "Expected test-import-boundary diagnostic")
	}

	@Scenario("Reject invalid testType values")
	static async rejectsInvalidTestType(input: object = {}, assert: AssertFn) {
		const diagnostics = MustHaveTestRuleTest.runRuleOn(
			"/src/MathObject.test.lll.ts",
			`
import { MathObject } from "./MathObject.lll"
export class MathObjectTest {
	testType = "api"
	@Scenario("s")
	static async s(input = {}, assert: AssertFn) {
		assert(!!MathObject, "host class should be available")
	}
}
`,
			{
				"/src/MathObject.lll.ts": `export class MathObject {}`
			}
		)
		assert(diagnostics.some(d => d.ruleCode === "bad-test-type"), "Expected bad-test-type diagnostic")
	}

	@Scenario("Accept behavioral tests with CSSResult styles and TemplateResult render")
	static async acceptsBehavioralLitTypes(input: object = {}, assert: AssertFn) {
		const diagnostics = MustHaveTestRuleTest.runRuleOn(
			"/src/App.test.lll.ts",
			`
import { App } from "./App.lll"
export class AppTest extends LitElement {
	testType = "behavioral"
	static styles: CSSResult = {} as CSSResult
	render(): TemplateResult<{ label: string }> {
		return {} as TemplateResult<{ label: string }>
	}
	@Scenario("s")
	static async s(input = {}, assert: AssertFn) {
		assert(!!App, "host class should be available")
	}
}
`,
			{
				"/src/App.lll.ts": `export class App {}`
			}
		)
		assert(
			diagnostics.length === 0,
			"Expected behavioral companion to accept CSSResult styles and TemplateResult render type"
		)
	}

	@Scenario("Reject behavioral render return type outside string or TemplateResult")
	static async rejectsUnsupportedBehavioralRenderType(input: object = {}, assert: AssertFn) {
		const diagnostics = MustHaveTestRuleTest.runRuleOn(
			"/src/App.test.lll.ts",
			`
import { App } from "./App.lll"
export class AppTest extends LitElement {
	testType = "behavioral"
	static styles: CSSResult = {} as CSSResult
	render(): number {
		return 1
	}
	@Scenario("s")
	static async s(input = {}, assert: AssertFn) {
		assert(!!App, "host class should be available")
	}
}
`,
			{
				"/src/App.lll.ts": `export class App {}`
			}
		)
		assert(
			diagnostics.some(d => d.message.includes("must return string or TemplateResult")),
			"Expected unsupported render return type to be rejected"
		)
	}
}
