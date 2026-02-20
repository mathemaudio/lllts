import { AssertFn } from "../public/lll.lll"
import { Scenario } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { MustHaveSpecHeaderRule } from "./MustHaveSpecHeaderRule.lll"
import { Project } from "ts-morph"

@Spec("Ensures @Spec decorators exist on classes and methods.")
export class MustHaveSpecHeaderRuleTest {
	testType = "unit"

	@Scenario("Check for spec header")
	static async checkSpecHeader(input: object = {}, assert: AssertFn) {
		const rule = MustHaveSpecHeaderRule.getRule()
		console.log(`Rule ${rule.id}: ${rule.title}`)
		assert(rule.title.includes("spec"), "Rule title should mention spec")
	}

	@Scenario("Allow constructor with first Spec call")
	static async allowConstructorWithLeadingSpecCall(input: object = {}, assert: AssertFn) {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(
			"/tmp/GoodCtor.lll.ts",
			`@Spec("class")
export class GoodCtor {
	constructor(private value: number) {
		Spec("constructor")
		this.value = this.value + 1
	}
	@Spec("method")
	public getValue() { return this.value }
}`
		)

		const diagnostics = MustHaveSpecHeaderRule.getRule().run(sourceFile)
		const ctorDiagnostics = diagnostics.filter(diag => diag.message.includes("Constructor must call Spec"))
		assert(ctorDiagnostics.length === 0, "Constructor with leading Spec call should pass")
	}

	@Scenario("Require constructor to begin with Spec call")
	static async requireConstructorLeadingSpecCall(input: object = {}, assert: AssertFn) {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(
			"/tmp/BadCtor.lll.ts",
			`@Spec("class")
export class BadCtor {
	constructor(private value: number) {
		this.value = value
		Spec("constructor")
	}
	@Spec("method")
	public getValue() { return this.value }
}`
		)

		const diagnostics = MustHaveSpecHeaderRule.getRule().run(sourceFile)
		const ctorDiagnostics = diagnostics.filter(diag => diag.message.includes("Constructor must call Spec"))
		assert(ctorDiagnostics.length === 1, "Constructor without leading Spec call should fail")
	}

	@Scenario("Allow empty constructor with no params and no Spec call")
	static async allowEmptyConstructorWithoutSpec(input: object = {}, assert: AssertFn) {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(
			"/tmp/EmptyCtor.lll.ts",
			`@Spec("class")
export class EmptyCtor {
	constructor() {}
	@Spec("method")
	public ping() { return "ok" }
}`
		)

		const diagnostics = MustHaveSpecHeaderRule.getRule().run(sourceFile)
		const ctorDiagnostics = diagnostics.filter(diag => diag.message.includes("Constructor must call Spec"))
		assert(ctorDiagnostics.length === 0, "Empty constructor with no params should not require Spec call")
	}
}
