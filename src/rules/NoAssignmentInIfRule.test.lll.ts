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

	@Scenario("Rejects assignment inside while condition")
	static async rejectsAssignmentInsideWhileCondition(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAssignmentInIfRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		let value = 0
		while ((value = value + 1) < 3) {
			value = value + 1
		}
	}
}`
		)
		assert(diagnostics.some(d => d.message.includes("while conditions")), "Expected assignment inside while condition to fail")
	}

	@Scenario("Rejects assignment inside do while condition")
	static async rejectsAssignmentInsideDoWhileCondition(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAssignmentInIfRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		let value = 0
		do {
			value = value + 1
		} while ((value += 1) < 4)
	}
}`
		)
		assert(diagnostics.some(d => d.message.includes("do while conditions")), "Expected assignment inside do while condition to fail")
	}

	@Scenario("Rejects assignment inside for condition")
	static async rejectsAssignmentInsideForCondition(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAssignmentInIfRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		for (let value = 0; (value = value + 1) < 3; value = value + 1) {
		}
	}
}`
		)
		assert(diagnostics.some(d => d.message.includes("for conditions")), "Expected assignment inside for condition to fail")
	}

	@Scenario("Rejects assignment inside ternary condition")
	static async rejectsAssignmentInsideTernaryCondition(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAssignmentInIfRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		let ready = false
		const result = (ready = true) ? 1 : 0
		return result
	}
}`
		)
		assert(diagnostics.some(d => d.message.includes("ternary conditions")), "Expected assignment inside ternary condition to fail")
	}

	@Scenario("Allows assignments outside the ternary condition slot")
	static async allowsAssignmentsOutsideTernaryConditionSlot(input: object = {}, assert: AssertFn) {
		const diagnostics = NoAssignmentInIfRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		let value = 0
		const result = value === 0 ? (value = 1) : (value = 2)
		return result
	}
}`
		)
		assert(diagnostics.length === 0, "Expected ternary branches to remain outside this rule")
	}
}
