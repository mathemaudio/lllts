import { Project } from "ts-morph"
import { AssertFn, Scenario, Spec } from "../../public/lll.lll"
import "./NoFloatingPromisesRule.lll"
import { NoFloatingPromisesRule } from "./NoFloatingPromisesRule.lll"

@Spec("Validates the ban on floating promises inside async code.")
export class NoFloatingPromisesRuleTest {
	testType = "unit"

	@Spec("Runs NoFloatingPromisesRule on an in-memory source file.")
	private static runRuleOn(filePath: string, body: string): import('../../core/DiagnosticObject').DiagnosticObject[] {
		const project = new Project({
			useInMemoryFileSystem: true,
			compilerOptions: {
				target: 7,
				lib: ["es2020"]
			}
		})
		const sourceFile = project.createSourceFile(filePath, body)
		return NoFloatingPromisesRule.getRule().run(sourceFile)
	}

	@Scenario("Verifies rule registration basics")
	static async verifyRuleRegistration(input: object = {}, assert: AssertFn) {
		const rule = NoFloatingPromisesRule.getRule()
		assert(rule.id === "R18", "Rule id should be R18")
		assert(rule.title === "No floating promises in async code", "Rule title should be 'No floating promises in async code'")
	}

	@Scenario("Rejects promise values that are declared but never awaited or returned")
	static async rejectsFloatingPromiseVariables(input: object = {}, assert: AssertFn) {
		const diagnostics = NoFloatingPromisesRuleTest.runRuleOn(
			"/src/Worker.lll.ts",
			`type promise_like<T> = {
	then(onfulfilled?: (value: T) => unknown, onrejected?: (reason: unknown) => unknown): unknown
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
		const pending = Worker.fetchLater()
		return "done"
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one floating-promise diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0].ruleCode === "no-floating-promises", "Expected no-floating-promises diagnostic code")
		assert(diagnostics[0].message.includes("Await it"), "Expected diagnostic message to explain the required handling")
	}

	@Scenario("Allows promise values that are awaited later")
	static async allowsAwaitedPromiseVariables(input: object = {}, assert: AssertFn) {
		const diagnostics = NoFloatingPromisesRuleTest.runRuleOn(
			"/src/Worker.lll.ts",
			`type promise_like<T> = {
	then(onfulfilled?: (value: T) => unknown, onrejected?: (reason: unknown) => unknown): unknown
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
		const pending = Worker.fetchLater()
		await pending
		return "done"
	}
}`
		)
		assert(diagnostics.length === 0, "Expected awaited promise variables to pass")
	}

	@Scenario("Allows promise values that are returned from async code")
	static async allowsReturnedPromiseVariables(input: object = {}, assert: AssertFn) {
		const diagnostics = NoFloatingPromisesRuleTest.runRuleOn(
			"/src/Worker.lll.ts",
			`type promise_like<T> = {
	then(onfulfilled?: (value: T) => unknown, onrejected?: (reason: unknown) => unknown): unknown
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
		const pending = Worker.fetchLater()
		return pending
	}
}`
		)
		assert(diagnostics.length === 0, "Expected returned promise variables to pass")
	}

	@Scenario("Rejects promise collections that are created but never combined")
	static async rejectsFloatingPromiseCollections(input: object = {}, assert: AssertFn) {
		const diagnostics = NoFloatingPromisesRuleTest.runRuleOn(
			"/src/Worker.lll.ts",
			`type promise_like<T> = {
	then(onfulfilled?: (value: T) => unknown, onrejected?: (reason: unknown) => unknown): unknown
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
		const pendingList = [Worker.fetchLater(), Worker.fetchLater()]
		return pendingList.length
	}
}`
		)
		assert(diagnostics.length === 1, `Expected one floating collection diagnostic, got ${diagnostics.length}`)
		assert(diagnostics[0].message.includes("Collection of promises"), "Expected collection-specific diagnostic message")
	}

	@Scenario("Allows promise collections passed to Promise.all")
	static async allowsPromiseCollectionsHandledByCombinators(input: object = {}, assert: AssertFn) {
		const diagnostics = NoFloatingPromisesRuleTest.runRuleOn(
			"/src/Worker.lll.ts",
			`type promise_like<T> = {
	then(onfulfilled?: (value: T) => unknown, onrejected?: (reason: unknown) => unknown): unknown
}

declare const Promise: {
	all<T>(values: T[]): promise_like<T[]>
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
		const pendingList = [Worker.fetchLater(), Worker.fetchLater()]
		await Promise.all(pendingList)
		return "done"
	}
}`
		)
		assert(diagnostics.length === 0, "Expected Promise.all handling to pass")
	}

	@Scenario("Ignores non-async code because the rule is scoped to async functions")
	static async ignoresNonAsyncCode(input: object = {}, assert: AssertFn) {
		const diagnostics = NoFloatingPromisesRuleTest.runRuleOn(
			"/src/Worker.lll.ts",
			`type promise_like<T> = {
	then(onfulfilled?: (value: T) => unknown, onrejected?: (reason: unknown) => unknown): unknown
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
		const pending = Worker.fetchLater()
		return pending
	}
}`
		)
		assert(diagnostics.length === 0, "Expected non-async code to be outside the rule scope")
	}
}
