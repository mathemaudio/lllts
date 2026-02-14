import { AssertFn } from "../public/lll.lll"
import { Out } from "../public/lll.lll"
import { Scenario } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { OneClassPerFileRule } from "./OneClassPerFileRule.lll"
import { Project } from "ts-morph"

@Spec("Demonstrates validation of single-export requirement.")

export class OneClassPerFileRuleTest {
	testType = "unit"

	@Spec("Runs OneClassPerFileRule on an in-memory source file.")
	@Out("diagnostics", "import('../core/DiagnosticObject').DiagnosticObject[]")
	private static runRuleOn(filePath: string, body: string) {
		const project = new Project({ useInMemoryFileSystem: true })
		const sourceFile = project.createSourceFile(filePath, body)
		return OneClassPerFileRule.getRule().run(sourceFile)
	}

	@Scenario("Check single export file")
	static async checkSingleExport(input: object = {}, assert: AssertFn) {
		const diagnostics = OneClassPerFileRuleTest.runRuleOn(
			"/src/OneClassPerFileRule.lll.ts",
			`export class OneClassPerFileRule {}`
		)
		assert(diagnostics.length === 0, "Expected single export file to pass")
	}

	@Scenario("Keep non-test class/file name matching unchanged")
	static async keepNonTestNamingUnchanged(input: object = {}, assert: AssertFn) {
		const diagnostics = OneClassPerFileRuleTest.runRuleOn(
			"/src/MathObject.lll.ts",
			`export class WrongName {}`
		)
		assert(diagnostics.some(d => d.ruleCode === "name-mismatch"), "Expected classic name-mismatch on non-test files")
	}

	@Scenario("Allow pure re-export barrel files")
	static async allowPureReExportBarrels(input: object = {}, assert: AssertFn) {
		const diagnostics = OneClassPerFileRuleTest.runRuleOn(
			"/src/public/index.ts",
			`export * from './api'
export * from './types/ApiEndpoints'
export * from './types/EndpointMethod'`
		)
		assert(diagnostics.length === 0, "Expected pure re-export barrel to skip one-export checks")
	}
}
