import { Project, SourceFile } from 'ts-morph'
import { AssertFn, Scenario, ScenarioParameter, Spec } from '../../public/lll.lll'
import './MustHaveTestRule.lll'
import { MustHaveTestRule } from './MustHaveTestRule.lll'

@Spec('Ensures the rule validates plain companion classes and scenario signatures.')
export class MustHaveTestRuleTest {
	testType = 'unit'

	@Spec('Builds an in-memory source file for rule testing.')
	private static buildSource(project: Project, filePath: string, body: string): SourceFile {
		return project.createSourceFile(filePath, body)
	}

	@Spec('Runs the rule against one in-memory source file.')
	private static runRuleOn(filePath: string, source: string, supportFiles: Record<string, string> = {}): import('../../core/DiagnosticObject').DiagnosticObject[] {
		const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { experimentalDecorators: true } })
		for (const [supportPath, supportBody] of Object.entries(supportFiles)) {
			this.buildSource(project, supportPath, supportBody)
		}
		const sourceFile = this.buildSource(project, filePath, source)
		return MustHaveTestRule.getRule().run(sourceFile)
	}

	@Scenario('accepts static-only host scenarios with ScenarioParameter only')
	static async acceptsStaticOnlyScenarioContract(scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		const diagnostics = this.runRuleOn(
			'/src/MathObject.test.lll.ts',
			`
import "./MathObject.lll"
import { Scenario, ScenarioParameter, Spec } from "../public/lll.lll"

export class MathObjectTest {
	testType = "unit"

	@Scenario("s")
	static async s(scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		assert(true, "static-only host should accept ScenarioParameter only")
	}
}
`,
			{
				'/src/MathObject.lll.ts': `export class MathObject { static add(a: number, b: number) { return a + b } }`
			}
		)
		assert(diagnostics.length === 0, 'Expected static-only host scenario contract to pass')
	}

	@Scenario('accepts instantiable host scenarios with subjectFactory and ScenarioParameter')
	static async acceptsInstantiableScenarioContract(scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		const diagnostics = this.runRuleOn(
			'/src/App.test.lll.ts',
			`
import "./App.lll"
import { Scenario, ScenarioParameter, Spec, SubjectFactory } from "../public/lll.lll"
import { App } from "./App.lll"

export class AppTest {
	testType = "behavioral"

	@Scenario("s")
	static async s(subjectFactory: SubjectFactory<App>, scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		assert(typeof subjectFactory === "function", "instantiable host should accept subjectFactory")
	}
}
`,
			{
				'/src/App.lll.ts': `export class App { value = 1 }`
			}
		)
		assert(diagnostics.length === 0, 'Expected instantiable host scenario contract to pass')
	}

	@Scenario('rejects extends clauses on companions')
	static async rejectsCompanionExtends(scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		const diagnostics = this.runRuleOn(
			'/src/App.test.lll.ts',
			`
import "./App.lll"
export class AppTest extends LitElement {
	testType = "behavioral"

	@Scenario("s")
	static async s(subjectFactory: SubjectFactory<App>, scenario: ScenarioParameter) {}
}
`,
			{
				'/src/App.lll.ts': `export class App { value = 1 }`
			}
		)
		assert(diagnostics.some(d => d.message.includes('must not extend any base class')), 'Expected extends clause to be rejected')
	}

	@Scenario('rejects render styles lifecycle and customElement on companions')
	static async rejectsComponentStyleCompanionMembers(scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		const diagnostics = this.runRuleOn(
			'/src/App.test.lll.ts',
			`
import "./App.lll"
@customElement("app-test")
export class AppTest {
	testType = "behavioral"
	static styles = ""
	connectedCallback() {}
	disconnectedCallback() {}
	render() {
		return ""
	}

	@Scenario("s")
	static async s(subjectFactory: SubjectFactory<App>, scenario: ScenarioParameter) {}
}
`,
			{
				'/src/App.lll.ts': `export class App { value = 1 }`
			}
		)
		assert(diagnostics.some(d => d.message.includes('must not declare static styles')), 'Expected static styles to be rejected')
		assert(diagnostics.some(d => d.message.includes('must not declare connectedCallback()')), 'Expected connectedCallback to be rejected')
		assert(diagnostics.some(d => d.message.includes('must not declare disconnectedCallback()')), 'Expected disconnectedCallback to be rejected')
		assert(diagnostics.some(d => d.message.includes('must not declare render()')), 'Expected render() to be rejected')
		assert(diagnostics.some(d => d.message.includes('must not use @customElement')), 'Expected @customElement to be rejected')
	}

	@Scenario('rejects old three-argument scenario signature')
	static async rejectsLegacyThreeArgumentScenarioSignature(scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		const diagnostics = this.runRuleOn(
			'/src/App.test.lll.ts',
			`
import "./App.lll"
export class AppTest {
	testType = "behavioral"

	@Scenario("s")
	static async s(input = {}, assert: AssertFn, waitFor: WaitForFn) {}
}
`,
			{
				'/src/App.lll.ts': `export class App { value = 1 }`
			}
		)
		assert(diagnostics.some(d => d.message.includes('exactly two parameters')), 'Expected old three-argument signature to be rejected')
	}

	@Scenario('rejects wrong parameter order or names')
	static async rejectsWrongScenarioParameterOrder(scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		const diagnostics = this.runRuleOn(
			'/src/App.test.lll.ts',
			`
import "./App.lll"
export class AppTest {
	testType = "behavioral"

	@Scenario("s")
	static async s(scenario: ScenarioParameter, subjectFactory: SubjectFactory<App>) {}
}
`,
			{
				'/src/App.lll.ts': `export class App { value = 1 }`
			}
		)
		assert(diagnostics.some(d => d.message.includes('subjectFactory: SubjectFactory<Subject>, scenario: ScenarioParameter')), 'Expected wrong parameter order to be rejected')
	}

	@Scenario('rejects static-only hosts that still declare subjectFactory')
	static async rejectsSubjectFactoryForStaticOnlyHosts(scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		const diagnostics = this.runRuleOn(
			'/src/MathObject.test.lll.ts',
			`
import "./MathObject.lll"
export class MathObjectTest {
	testType = "unit"

	@Scenario("s")
	static async s(subjectFactory: SubjectFactory<MathObject>, scenario: ScenarioParameter) {}
}
`,
			{
				'/src/MathObject.lll.ts': `export class MathObject { static add(a: number, b: number) { return a + b } }`
			}
		)
		assert(diagnostics.some(d => d.message.includes('exactly one parameter')), 'Expected static-only host to reject subjectFactory')
	}

	@Scenario('keeps testType validation')
	static async rejectsInvalidTestType(scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		const diagnostics = this.runRuleOn(
			'/src/MathObject.test.lll.ts',
			`
import "./MathObject.lll"
export class MathObjectTest {
	testType = "api"

	@Scenario("s")
	static async s(scenario: ScenarioParameter) {}
}
`,
			{
				'/src/MathObject.lll.ts': `export class MathObject { static add(a: number, b: number) { return a + b } }`
			}
		)
		assert(diagnostics.some(d => d.ruleCode === 'bad-test-type'), 'Expected invalid testType to remain rejected')
	}

	@Scenario('keeps host side-effect import validation')
	static async rejectsNamedImportWithoutSideEffectImport(scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		const diagnostics = this.runRuleOn(
			'/src/MathObject.test.lll.ts',
			`
import { MathObject } from "./MathObject.lll"
export class MathObjectTest {
	testType = "unit"

	@Scenario("s")
	static async s(scenario: ScenarioParameter) {
		const assert: AssertFn = scenario.assert
		assert(!!MathObject, "host class should be available")
	}
}
`,
			{
				'/src/MathObject.lll.ts': `export class MathObject { static add(a: number, b: number) { return a + b } }`
			}
		)
		assert(diagnostics.some(d => d.message.includes('must side-effect import host module')), 'Expected missing host side-effect import to remain rejected')
	}
}
