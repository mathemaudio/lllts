import { Project } from "ts-morph"
import { AssertFn, Scenario, Spec, WaitForFn } from "../../public/lll.lll"
import "./MaxFolderBreadthRule.lll"
import { MaxFolderBreadthRule } from "./MaxFolderBreadthRule.lll"

@Spec("Covers MaxFolderBreadthRule registration basics.")
export class MaxFolderBreadthRuleTest {
	testType = "unit"

	@Scenario("Verify rule is registered with correct id")
	static async verifyRuleId(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const rule = MaxFolderBreadthRule.getRule()
		assert(rule.id === "R9", "Rule id should be R9")
	}

	@Scenario("Verify rule title is correct")
	static async verifyRuleTitle(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const rule = MaxFolderBreadthRule.getRule()
		assert(rule.title === "Max folder breadth", "Rule title should be 'Max folder breadth'")
	}

	@Scenario("Verify folder breadth diagnostics are emitted once per project")
	static async verifyProjectDiagnosticsAreNotDuplicated(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const project = new Project({ useInMemoryFileSystem: true })
		for (let i = 1; i <= 13; i++) {
			const name = `Rule${String(i).padStart(2, "0")}`
			project.createSourceFile(
				`/repo/src/rules/${name}.lll.ts`,
				`export class ${name} {}`
			)
		}

		const rule = MaxFolderBreadthRule.getRule()
		const firstFile = project.getSourceFileOrThrow("/repo/src/rules/Rule01.lll.ts")
		const secondFile = project.getSourceFileOrThrow("/repo/src/rules/Rule02.lll.ts")

		const firstDiagnostics = rule.run(firstFile)
		const secondDiagnostics = rule.run(secondFile)

		assert(firstDiagnostics.length === 1, "First project-wide invocation should emit one folder diagnostic")
		assert(firstDiagnostics[0].ruleCode === "folder-too-many-files", "Diagnostic should target the file-count limit")
		assert(secondDiagnostics.length === 0, "Subsequent file invocations should not repeat the same project-wide diagnostic")
	}

	@Scenario("Verify plain TypeScript files count toward the folder file limit while tests stay excluded")
	static async verifyPlainTypeScriptFilesAreCounted(input: object = {}, assert: AssertFn, waitFor: WaitForFn) {
		const project = new Project({ useInMemoryFileSystem: true })
		project.createSourceFile("/repo/src/core/Anchor.lll.ts", "export class Anchor {}")

		for (let i = 1; i <= 12; i++) {
			project.createSourceFile(
				`/repo/src/core/Helper${String(i).padStart(2, "0")}.ts`,
				`export const helper${i} = ${i}`
			)
		}

		project.createSourceFile("/repo/src/core/Anchor.test.lll.ts", "export class AnchorTest {}")
		project.createSourceFile("/repo/src/core/Helper13.test.ts", "export const helperTest = 13")

		const rule = MaxFolderBreadthRule.getRule()
		const anchorFile = project.getSourceFileOrThrow("/repo/src/core/Anchor.lll.ts")
		const diagnostics = rule.run(anchorFile)

		assert(diagnostics.length === 1, "Expected one folder breadth diagnostic for counted TypeScript files")
		assert(diagnostics[0].ruleCode === "folder-too-many-files", "Diagnostic should target the file-count limit")
		assert(diagnostics[0].message.includes("13 source files"), "Expected only non-test TypeScript files to be counted")
	}
}
