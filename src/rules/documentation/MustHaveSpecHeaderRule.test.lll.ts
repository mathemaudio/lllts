import { Project } from "ts-morph"
import { AssertFn, Scenario, Spec } from "../../public/lll.lll"
import "./MustHaveSpecHeaderRule.lll"
import { MustHaveSpecHeaderRule } from "./MustHaveSpecHeaderRule.lll"

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

	@Scenario("Allow short exported type without leading Spec call")
	static async allowShortExportedTypeWithoutLeadingSpec(input: object = {}, assert: AssertFn) {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(
			"/tmp/GoodType.ts",
			`export type GoodType = {
	value: string
}`
		)

		const diagnostics = MustHaveSpecHeaderRule.getRule().run(sourceFile)
		const typeDiagnostics = diagnostics.filter(diag => diag.ruleCode === "missing-spec-type")
		assert(typeDiagnostics.length === 0, "Short exported type should not require leading Spec call")
	}

	@Scenario("Require leading Spec for exported type with more than 10 lines")
	static async requireLeadingSpecForLongExportedType(input: object = {}, assert: AssertFn) {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(
			"/tmp/BadLongType.ts",
			`export type BadLongType =
	| { tag: "a"; v: string }
	| { tag: "b"; v: string }
	| { tag: "c"; v: string }
	| { tag: "d"; v: string }
	| { tag: "e"; v: string }
	| { tag: "f"; v: string }
	| { tag: "g"; v: string }
	| { tag: "h"; v: string }
	| { tag: "i"; v: string }
	| { tag: "j"; v: string }
	| { tag: "k"; v: string }
	| { tag: "l"; v: string }`
		)

		const diagnostics = MustHaveSpecHeaderRule.getRule().run(sourceFile)
		const typeDiagnostics = diagnostics.filter(diag => diag.ruleCode === "missing-spec-type")
		assert(typeDiagnostics.length === 1, "Exported type with more than 10 lines should require leading Spec call")
	}

	@Scenario("Require leading Spec for exported type with more than 10 members")
	static async requireLeadingSpecForManyMembersExportedType(input: object = {}, assert: AssertFn) {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(
			"/tmp/BadManyMembersType.ts",
			`export type BadManyMembersType = {
	a: string
	b: string
	c: string
	d: string
	e: string
	f: string
	g: string
	h: string
	i: string
	j: string
	k: string
}`
		)

		const diagnostics = MustHaveSpecHeaderRule.getRule().run(sourceFile)
		const typeDiagnostics = diagnostics.filter(diag => diag.ruleCode === "missing-spec-type")
		assert(typeDiagnostics.length === 1, "Exported type with more than 10 members should require leading Spec call")
	}

	@Scenario("Allow complex exported type with immediate leading Spec call")
	static async allowComplexExportedTypeWithImmediateLeadingSpec(input: object = {}, assert: AssertFn) {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(
			"/tmp/GoodComplexType.ts",
			`Spec("complex type")
export type GoodComplexType = {
	a: string
	b: string
	c: string
	d: string
	e: string
	f: string
	g: string
	h: string
	i: string
	j: string
	k: string
}`
		)

		const diagnostics = MustHaveSpecHeaderRule.getRule().run(sourceFile)
		const typeDiagnostics = diagnostics.filter(diag => diag.ruleCode === "missing-spec-type")
		assert(typeDiagnostics.length === 0, "Complex exported type with immediate leading Spec call should pass")
	}
}
