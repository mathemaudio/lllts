import { Project } from "ts-morph"
import { AssertFn, Out, Scenario, Spec } from "../public/lll.lll"
import { NoAssignmentInIfRule } from "./NoAssignmentInIfRule.lll"

@Spec("Validates the ban on assignment expressions inside if conditions.")
export class NoAssignmentInIfRuleTest {
	testType = "unit"

	@Spec("Runs NoAssignmentInIfRule on an in-memory source file.")
	@Out("diagnostics", "import('../core/DiagnosticObject').DiagnosticObject[]")
	private static runRuleOn(filePath: string, body: string) {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(filePath, body)
		return NoAssignmentInIfRule.getRule().run(sourceFile)
	}

	@Scenario("Allows pure boolean checks inside if")
	static async allowsPureBooleanChecks(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAssignmentInIfRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		let value = 1
		if (value === 1) {
			value = 2
		}
	}
}`
		)
		assert(diagnostics.length === 0, "Expected equality check inside if to pass")
	}

	@Scenario("Rejects direct assignment inside if condition")
	static async rejectsDirectAssignmentInsideIfCondition(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAssignmentInIfRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		let value = 1
		if (value = 2) {
			value = 3
		}
	}
}`
		)
		assert(diagnostics.some(d => d.ruleCode === "assignment-in-if"), "Expected assignment-in-if diagnostic for '='")
	}

	@Scenario("Rejects compound assignment nested inside if condition")
	static async rejectsCompoundAssignmentNestedInsideIfCondition(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAssignmentInIfRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		let count = 0
		if ((count += 1) > 0) {
			count = 10
		}
	}
}`
		)
		assert(diagnostics.some(d => d.message.includes("'+='") || d.message.includes("+=")), "Expected compound assignment inside if to fail")
	}

	@Scenario("Rejects logical assignment inside nested if expression")
	static async rejectsLogicalAssignmentInsideNestedIfExpression(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAssignmentInIfRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		let ready = false
		const fallback = true
		if (ready || (ready ||= fallback)) {
			ready = true
		}
	}
}`
		)
		assert(diagnostics.some(d => d.ruleCode === "assignment-in-if"), "Expected logical assignment inside if to fail")
	}
}
