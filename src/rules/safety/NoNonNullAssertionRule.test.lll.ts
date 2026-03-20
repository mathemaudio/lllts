import { Project } from "ts-morph"
import { AssertFn, Out, Scenario, Spec } from "../../public/lll.lll"
import { NoNonNullAssertionRule } from "./NoNonNullAssertionRule.lll"
import "./NoNonNullAssertionRule.lll"

@Spec("Validates the ban on postfix non-null assertions.")
export class NoNonNullAssertionRuleTest {
	testType = "unit"

	@Spec("Runs NoNonNullAssertionRule on an in-memory source file.")
	@Out("diagnostics", "import('../../core/DiagnosticObject').DiagnosticObject[]")
	private static runRuleOn(filePath: string, body: string) {
		const project = new Project({
			useInMemoryFileSystem: true,
			compilerOptions: {
				strict: true
			}
		})
		const sourceFile = project.createSourceFile(filePath, body)
		return NoNonNullAssertionRule.getRule().run(sourceFile)
	}

	@Scenario("Verifies rule registration basics")
	static async verifyRuleRegistration(input: object = {}, assert: AssertFn) {
		const rule = NoNonNullAssertionRule.getRule()
		assert(rule.id === "R15", "Rule id should be R15")
		assert(rule.title === "No non-null assertion", "Rule title should be 'No non-null assertion'")
	}

	@Scenario("Rejects postfix non-null assertions")
	static async rejectsPostfixNonNullAssertions(input: object = {}, assert: AssertFn) {
		const diagnostics = NoNonNullAssertionRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class User {
	name = "Ada"
}

export class MathObject {
	static main(user: User | null) {
		return user!.name
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one non-null assertion diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0].ruleCode === "no-non-null-assertion", "Expected no-non-null-assertion diagnostic code")
		assert(diagnostics[0].message.includes("user!"), "Expected diagnostic message to mention the asserted operand")
	}

	@Scenario("Rejects nested and repeated non-null assertions")
	static async rejectsNestedAndRepeatedNonNullAssertions(input: object = {}, assert: AssertFn) {
		const diagnostics = NoNonNullAssertionRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class Box {
	value = 1
}

export class MathObject {
	static main(boxes: Array<Box | null> | null) {
		return boxes![0]!.value
	}
}`
		)
		assert(diagnostics.length === 2, `Expected two non-null assertion diagnostics, got ${diagnostics.length}`)
		assert(diagnostics.every(diagnostic => diagnostic.ruleCode === "no-non-null-assertion"), "Expected only no-non-null-assertion diagnostics")
	}

	@Scenario("Allows explicit narrowing and definite assignment fields")
	static async allowsExplicitNarrowingAndDefiniteAssignmentFields(input: object = {}, assert: AssertFn) {
		const diagnostics = NoNonNullAssertionRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class Worker {
	name!: string
}

export class MathObject {
	static main(worker: Worker | null) {
		if (worker === null) {
			return "none"
		}
		return worker.name
	}
}`
		)
		assert(diagnostics.length === 0, "Expected explicit narrowing and definite assignment fields to pass")
	}
}
