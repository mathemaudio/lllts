import { Project } from "ts-morph"
import { AssertFn, Scenario, Spec, WaitForFn } from "../../../public/lll.lll"
import "./NoImplicitPrimitiveCoercionRule.lll"
import { NoImplicitPrimitiveCoercionRule } from "./NoImplicitPrimitiveCoercionRule.lll"

@Spec("Validates the ban on implicit primitive coercion in arithmetic operators.")
export class NoImplicitPrimitiveCoercionRuleTest {
	testType = "unit"

	@Spec("Runs NoImplicitPrimitiveCoercionRule on an in-memory source file.")
	private static runRuleOn(filePath: string, body: string): import('../../../core/DiagnosticObject').DiagnosticObject[] {
		const project = new Project({
			useInMemoryFileSystem: true,
			compilerOptions: {
				strict: true
			}
		})
		const sourceFile = project.createSourceFile(filePath, body)
		return NoImplicitPrimitiveCoercionRule.getRule().run(sourceFile)
	}

	@Scenario("Verifies rule registration basics")
	static async verifyRuleRegistration(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const rule = NoImplicitPrimitiveCoercionRule.getRule()
		assert(rule.id === "R13", "Rule id should be R13")
		assert(rule.title === "No implicit primitive coercion", "Rule title should be 'No implicit primitive coercion'")
	}

	@Scenario("Allows arithmetic on statically numeric operands")
	static async allowsNumericArithmetic(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = NoImplicitPrimitiveCoercionRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		type branded_number = number & { readonly brand: "n" }
		enum Mode {
			One = 1
		}
		const raw = 4
		const branded = 2 as branded_number
		const union = 1 as 1 | 2
		const total = raw - union
		const scaled = branded * Mode.One
		const ratio = total / scaled
		const rest = ratio % 2
		return -rest
	}
}`
		)
		assert(diagnostics.length === 0, "Expected statically numeric arithmetic to pass")
	}

	@Scenario("Rejects binary arithmetic that would rely on coercion")
	static async rejectsBinaryArithmeticCoercion(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = NoImplicitPrimitiveCoercionRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		const text = "5"
		const flag = true
		const left = text - 2
		const right = 3 * flag
		return left + right
	}
}`
		)
		assert(diagnostics.length === 2, `Expected two primitive coercion diagnostics, got ${diagnostics.length}`)
		assert(diagnostics.every(diagnostic => diagnostic.ruleCode === "no-implicit-primitive-coercion"), "Expected primitive coercion diagnostic code")
		assert(diagnostics.some(diagnostic => diagnostic.message.includes(`'"5"' - '2'`)), "Expected a string arithmetic diagnostic")
		assert(diagnostics.some(diagnostic => diagnostic.message.includes(`'3' * 'true'`)), "Expected a boolean arithmetic diagnostic")
	}

	@Scenario("Rejects unary arithmetic on non-numeric operands")
	static async rejectsUnaryArithmeticCoercion(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = NoImplicitPrimitiveCoercionRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		const text = "5"
		const flag = true
		const a = +text
		const b = -flag
		return a + b
	}
}`
		)
		assert(diagnostics.length === 2, `Expected two unary primitive coercion diagnostics, got ${diagnostics.length}`)
		assert(diagnostics.every(diagnostic => diagnostic.message.includes("requires a numeric operand")), "Expected unary diagnostic wording")
	}

	@Scenario("Rejects ambiguous unions and any-like arithmetic inputs")
	static async rejectsAmbiguousArithmeticInputs(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = NoImplicitPrimitiveCoercionRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class MathObject {
	static main() {
		const maybe = 1 as number | null
		const loose = 1 as any
		const first = maybe % 2
		const second = loose - 1
		return first + second
	}
}`
		)
		assert(diagnostics.length === 2, `Expected two ambiguous arithmetic diagnostics, got ${diagnostics.length}`)
		assert(diagnostics.some(diagnostic => diagnostic.message.includes("number | null")), "Expected nullable numeric diagnostic")
		assert(diagnostics.some(diagnostic => diagnostic.message.includes("any")), "Expected any diagnostic")
	}
}
