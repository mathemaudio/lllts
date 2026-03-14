import { Project } from "ts-morph"
import { AssertFn, Out, Scenario, Spec } from "../../public/lll.lll"
import { NoIgnoredPromisesRule } from "./NoIgnoredPromisesRule.lll"

@Spec("Validates the ban on ignored promises.")
export class NoIgnoredPromisesRuleTest {
	testType = "unit"

	@Spec("Runs NoIgnoredPromisesRule on an in-memory source file.")
	@Out("diagnostics", "import('../../core/DiagnosticObject').DiagnosticObject[]")
	private static runRuleOn(filePath: string, body: string) {
		const project = new Project({
			useInMemoryFileSystem: true,
			compilerOptions: {
				target: 7,
				lib: ["es2020"]
			}
		})
		const sourceFile = project.createSourceFile(filePath, body)
		return NoIgnoredPromisesRule.getRule().run(sourceFile)
	}

	@Scenario("Verifies rule registration basics")
	static async verifyRuleRegistration(input: object = {}, assert: AssertFn) {
		const rule = NoIgnoredPromisesRule.getRule()
		assert(rule.id === "R17", "Rule id should be R17")
		assert(rule.title === "No ignored promises", "Rule title should be 'No ignored promises'")
	}

	@Scenario("Rejects a bare promise-returning call")
	static async rejectsBarePromiseCalls(input: object = {}, assert: AssertFn) {
		const diagnostics = NoIgnoredPromisesRuleTest.runRuleOn(
			"/src/Worker.lll.ts",
			`type promise_like<T> = {
	then(onfulfilled?: (value: T) => unknown): unknown
}

export class Worker {
	static fetchLater(): promise_like<string> {
		return {
			then() {
				return "done"
			}
		}
	}

	static main() {
		Worker.fetchLater()
		return "done"
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one ignored-promise diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0].ruleCode === "no-ignored-promises", "Expected no-ignored-promises diagnostic code")
		assert(diagnostics[0].message.includes("must be awaited"), "Expected diagnostic message to explain the required handling")
	}

	@Scenario("Allows awaited promises")
	static async allowsAwaitedPromises(input: object = {}, assert: AssertFn) {
		const diagnostics = NoIgnoredPromisesRuleTest.runRuleOn(
			"/src/Worker.lll.ts",
			`type promise_like<T> = {
	then(onfulfilled?: (value: T) => unknown): unknown
}

export class Worker {
	static fetchLater(): promise_like<string> {
		return {
			then() {
				return "done"
			}
		}
	}

	static async main() {
		await Worker.fetchLater()
		return "done"
	}
}`
		)
		assert(diagnostics.length === 0, "Expected awaited promises to pass")
	}

	@Scenario("Allows promises that are assigned returned or explicitly voided")
	static async allowsExplicitPromiseHandlingPatterns(input: object = {}, assert: AssertFn) {
		const diagnostics = NoIgnoredPromisesRuleTest.runRuleOn(
			"/src/Worker.lll.ts",
			`type promise_like<T> = {
	then(onfulfilled?: (value: T) => unknown, onrejected?: (reason: unknown) => unknown): promise_like<T>
	catch(onrejected: (reason: unknown) => unknown): promise_like<T>
}

export class Worker {
	static fetchLater(): promise_like<string> {
		return {
			then() {
				return this
			},
			catch() {
				return this
			}
		}
	}

	static main() {
		const pending = Worker.fetchLater()
		if (pending === null) {
			return "none"
		}
		void Worker.fetchLater()
		Worker.fetchLater().catch(() => "ignored")
		return Worker.fetchLater()
	}
}`
		)
		assert(diagnostics.length === 0, "Expected explicit handling patterns to pass")
	}

	@Scenario("Rejects ignored PromiseLike values")
	static async rejectsIgnoredPromiseLikeValues(input: object = {}, assert: AssertFn) {
		const diagnostics = NoIgnoredPromisesRuleTest.runRuleOn(
			"/src/Worker.lll.ts",
			`type promise_like<T> = {
	then(onfulfilled?: (value: T) => unknown): unknown
}

export class Worker {
	static fetchLater(): promise_like<string> {
		return {
			then() {
				return "done"
			}
		}
	}

	static main() {
		Worker.fetchLater()
		return "done"
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one ignored-promise diagnostic for promise_like, got ${diagnostics.length}`)
	}
}
