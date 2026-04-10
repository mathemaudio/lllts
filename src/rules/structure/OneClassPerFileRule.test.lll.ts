import { Project } from "ts-morph"
import { AssertFn, Scenario, Spec, WaitForFn } from "../../public/lll.lll"
import "./OneClassPerFileRule.lll"
import { OneClassPerFileRule } from "./OneClassPerFileRule.lll"

@Spec("Demonstrates validation of single-export requirement.")

export class OneClassPerFileRuleTest {
	testType = "unit"

	@Spec("Runs OneClassPerFileRule on an in-memory source file.")
	private static runRuleOn(filePath: string, body: string): import('../../core/DiagnosticObject').DiagnosticObject[] {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(filePath, body)
		return OneClassPerFileRule.getRule().run(sourceFile)
	}

	@Scenario("Check single export file")
	static async checkSingleExport(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = OneClassPerFileRuleTest.runRuleOn(
			"/src/OneClassPerFileRule.lll.ts",
			`export class OneClassPerFileRule {}`
		)
		assert(diagnostics.length === 0, "Expected single export file to pass")
	}

	@Scenario("Keep non-test class/file name matching unchanged")
	static async keepNonTestNamingUnchanged(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = OneClassPerFileRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class WrongName {}`
		)
		assert(diagnostics.some(d => d.ruleCode === "name-mismatch"), "Expected classic name-mismatch on non-test files")
	}

	@Scenario("Allow pure re-export barrel files")
	static async allowPureReExportBarrels(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = OneClassPerFileRuleTest.runRuleOn(
			"/src/public/index.ts",
			`export * from './api'
export * from './types/ApiEndpoints'
export * from './types/EndpointMethod'`
		)
		assert(diagnostics.length === 0, "Expected pure re-export barrel to skip one-export checks")
	}

	@Scenario("Reject additional non-exported top-level type aliases")
	static async rejectLocalTopLevelHelperType(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = OneClassPerFileRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`type InternalName = string
export class MathObject {}`
		)
		assert(diagnostics.some(d => d.ruleCode === "extra-top-level"), "Expected local top-level helper type to be rejected")
	}

	@Scenario("Reject additional top-level interfaces even when non-exported")
	static async rejectLocalTopLevelInterface(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const diagnostics = OneClassPerFileRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`interface InternalShape { value: string }
export class MathObject {}`
		)
		assert(diagnostics.some(d => d.ruleCode === "extra-top-level"), "Expected local top-level interface to be rejected")
	}
}
