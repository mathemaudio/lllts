import { Spec, Scenario } from "../public/decorators.js"
import { AssertFn } from "../public/AssertFn.lll"
import { MathObject } from "./MathObject.lll"

@Spec("Interactive calculator scenarios for MathObject.")
export class MathObject_usecase {
	environment = "api"

	@Scenario("Default addition (2 + 3)")
	static async defaultAddition(input = {}, assert: AssertFn) {
		const sum = MathObject.add(2, 3)
		assert(sum === 5, "Expected sum to be 5")
	}

	@Scenario("Changed inputs (10 + 7)")
	static async changedInputs(input: { a?: number; b?: number } = {}, assert: AssertFn) {
		const a = input.a ?? 10
		const b = input.b ?? 7
		const sum = MathObject.add(a, b)
		assert(sum === 17, "Expected sum to be 17")
	}
}
