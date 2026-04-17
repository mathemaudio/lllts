import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { Project } from "ts-morph"
import { AssertFn, Scenario, Spec, WaitForFn, ScenarioParameter } from "../../public/lll.lll"
import type { RuleContext } from "../../core/rulesEngine/RuleContext"
import "./MaxFolderBreadthRule.lll"
import { MaxFolderBreadthRule } from "./MaxFolderBreadthRule.lll"

@Spec("Covers MaxFolderBreadthRule registration and physical filesystem breadth behavior.")
export class MaxFolderBreadthRuleTest {
	testType = "unit"

	@Scenario("Verify rule is registered with correct id")
	static async verifyRuleId(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const rule = MaxFolderBreadthRule.getRule()
		assert(rule.id === "R9", "Rule id should be R9")
	}

	@Scenario("Verify rule title is correct")
	static async verifyRuleTitle(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const rule = MaxFolderBreadthRule.getRule()
		assert(rule.title === "Max folder breadth", "Rule title should be 'Max folder breadth'")
	}

	@Scenario("Verify folder breadth diagnostics are emitted once per project")
	static async verifyProjectDiagnosticsAreNotDuplicated(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const fixture = MaxFolderBreadthRuleTest.createFixture()
		try {
			const firstFilePath = fixture.writeSource("src/rules/Rule01.lll.ts", "export class Rule01 {}")
			const secondFilePath = fixture.writeSource("src/rules/Rule02.lll.ts", "export class Rule02 {}")
			for (let i = 3; i <= MaxFolderBreadthRule.MAX_FILES + 1; i++) {
				const name = `Rule${String(i).padStart(2, "0")}`
				fixture.writeSource(`src/rules/${name}.lll.ts`, `export class ${name} {}`)
			}

			const project = new Project()
			const firstFile = project.addSourceFileAtPath(firstFilePath)
			const secondFile = project.addSourceFileAtPath(secondFilePath)
			const rule = MaxFolderBreadthRule.getRule()

			const firstDiagnostics = rule.run(firstFile, fixture.context("src/rules/Rule01.lll.ts"))
			const secondDiagnostics = rule.run(secondFile, fixture.context("src/rules/Rule01.lll.ts"))

			assert(firstDiagnostics.length === 1, "First project-wide invocation should emit one folder diagnostic")
			assert(firstDiagnostics[0].ruleCode === "folder-too-many-files", "Diagnostic should target the file-count limit")
			assert(secondDiagnostics.length === 0, "Subsequent file invocations should not repeat the same project-wide diagnostic")
		} finally {
			fixture.cleanup()
		}
	}

	@Scenario("Verify physical unimported source files under the entry root are counted")
	static async verifyPhysicalFilesAreCountedWhenNotImported(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const fixture = MaxFolderBreadthRuleTest.createFixture()
		try {
			const entryPath = fixture.writeSource("src/core/Entry.lll.ts", "export class Entry {}")
			for (let i = 1; i <= MaxFolderBreadthRule.MAX_FILES; i++) {
				fixture.writeSource(`src/core/Orphan${String(i).padStart(2, "0")}.lll.ts`, `export class Orphan${i} {}`)
			}

			const diagnostics = MaxFolderBreadthRuleTest.runRule(entryPath, fixture.context("src/core/Entry.lll.ts"))

			assert(diagnostics.length === 1, "Expected one diagnostic for physical orphan files")
			assert(diagnostics[0].ruleCode === "folder-too-many-files", "Expected orphan files to trigger folder-too-many-files")
			assert(diagnostics[0].message.includes(`${MaxFolderBreadthRule.MAX_FILES + 1} source files`), "Expected physical file count to include unimported files")
		} finally {
			fixture.cleanup()
		}
	}

	@Scenario("Verify removing old files clears folder file breadth diagnostics")
	static async verifyActualMoveClearsPhysicalFileDiagnostic(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const fixture = MaxFolderBreadthRuleTest.createFixture()
		try {
			const entryPath = fixture.writeSource("src/core/Entry.lll.ts", "export class Entry {}")
			const oldPath = fixture.writeSource("src/core/OldHelper.lll.ts", "export class OldHelper {}")
			for (let i = 1; i < MaxFolderBreadthRule.MAX_FILES; i++) {
				fixture.writeSource(`src/core/Helper${String(i).padStart(2, "0")}.lll.ts`, `export class Helper${i} {}`)
			}
			const before = MaxFolderBreadthRuleTest.runRule(entryPath, fixture.context("src/core/Entry.lll.ts"))
			fs.mkdirSync(path.join(fixture.root, "src", "moved"), { recursive: true })
			fs.renameSync(oldPath, path.join(fixture.root, "src", "moved", "OldHelper.lll.ts"))
			const after = MaxFolderBreadthRuleTest.runRule(entryPath, fixture.context("src/core/Entry.lll.ts"))

			assert(before.some(diagnostic => diagnostic.ruleCode === "folder-too-many-files"), "Expected original crowded folder to fail")
			assert(!after.some(diagnostic => diagnostic.ruleCode === "folder-too-many-files"), "Expected file breadth to pass after old file is moved away")
		} finally {
			fixture.cleanup()
		}
	}

	@Scenario("Verify declaration and supported test files are excluded from physical file counts")
	static async verifyTestAndDeclarationFilesAreExcluded(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const fixture = MaxFolderBreadthRuleTest.createFixture()
		try {
			const entryPath = fixture.writeSource("src/core/Entry.lll.ts", "export class Entry {}")
			for (let i = 1; i < MaxFolderBreadthRule.MAX_FILES; i++) {
				fixture.writeSource(`src/core/Helper${String(i).padStart(2, "0")}.lll.ts`, `export class Helper${i} {}`)
			}
			fixture.writeSource("src/core/Types.d.ts", "export type Declared = string")
			fixture.writeSource("src/core/Entry.test.lll.ts", "export class EntryTest {}")
			fixture.writeSource("src/core/Entry.test2.lll.ts", "export class EntryTest2 {}")
			fixture.writeSource("src/core/plain.test.ts", "export const value = 1")

			const diagnostics = MaxFolderBreadthRuleTest.runRule(entryPath, fixture.context("src/core/Entry.lll.ts"))

			assert(!diagnostics.some(diagnostic => diagnostic.ruleCode === "folder-too-many-files"), "Expected excluded test and declaration files not to affect file breadth")
		} finally {
			fixture.cleanup()
		}
	}

	@Scenario("Verify physical subfolder limits are enforced under the entry root")
	static async verifyPhysicalSubfolderLimitIsEnforced(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const fixture = MaxFolderBreadthRuleTest.createFixture()
		try {
			const entryPath = fixture.writeSource("src/Entry.lll.ts", "export class Entry {}")
			for (let i = 1; i <= MaxFolderBreadthRule.MAX_FOLDERS + 1; i++) {
				fixture.writeSource(`src/feature${String(i).padStart(2, "0")}/Thing.lll.ts`, "export class Thing {}")
			}

			const diagnostics = MaxFolderBreadthRuleTest.runRule(entryPath, fixture.context("src/Entry.lll.ts"))

			assert(diagnostics.length === 1, "Expected one subfolder breadth diagnostic")
			assert(diagnostics[0].ruleCode === "folder-too-many-folders", "Diagnostic should target the subfolder limit")
			assert(diagnostics[0].message.includes(`${MaxFolderBreadthRule.MAX_FOLDERS + 1} subfolders`), "Expected physical source child folder count")
		} finally {
			fixture.cleanup()
		}
	}

	@Scenario("Verify files outside the entry-derived source root are ignored")
	static async verifyPackageRootFilesOutsideEntryRootAreIgnored(scenario: ScenarioParameter) {
		const input = scenario.input
		const assert: AssertFn = scenario.assert
		const waitFor: WaitForFn = scenario.waitFor
		const fixture = MaxFolderBreadthRuleTest.createFixture()
		try {
			const entryPath = fixture.writeSource("src/Entry.lll.ts", "export class Entry {}")
			for (let i = 1; i <= MaxFolderBreadthRule.MAX_FILES + 1; i++) {
				fixture.writeSource(`root-extra-${i}.ts`, `export const extra${i} = ${i}`)
			}

			const diagnostics = MaxFolderBreadthRuleTest.runRule(entryPath, fixture.context("src/Entry.lll.ts"))

			assert(diagnostics.length === 0, "Expected package-root files outside src not to affect entry-derived source root")
		} finally {
			fixture.cleanup()
		}
	}

	@Spec("Runs the folder breadth rule for a physical entry file.")
	private static runRule(entryPath: string, context: RuleContext): import("../../core/DiagnosticObject").DiagnosticObject[] {
		const project = new Project()
		const entryFile = project.addSourceFileAtPath(entryPath)
		return MaxFolderBreadthRule.getRule().run(entryFile, context)
	}

	@Spec("Creates a temporary real-filesystem source fixture for breadth tests.")
	private static createFixture(): {
		root: string;
		writeSource(relativePath: string, text: string): string;
		context(entryRelativePath: string): RuleContext;
		cleanup(): void;
	} {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "lllts-breadth-"))
		return {
			root,
			writeSource(relativePath: string, text: string): string {
				const filePath = path.join(root, relativePath)
				fs.mkdirSync(path.dirname(filePath), { recursive: true })
				fs.writeFileSync(filePath, text, "utf8")
				return filePath
			},
			context(entryRelativePath: string): RuleContext {
				return {
					projectRootDir: root,
					entryFilePath: path.join(root, entryRelativePath),
					entrySourceRootDir: path.join(root, entryRelativePath.split(/[\\/]/)[0] ?? "")
				}
			},
			cleanup(): void {
				fs.rmSync(root, { recursive: true, force: true })
			}
		}
	}
}
