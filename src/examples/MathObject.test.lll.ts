import { AssertFn, Scenario, Spec, WaitForFn } from "../public/lll.lll.js"
import { MathObject } from "./MathObject.lll"

@Spec("Interactive calculator scenarios for MathObject.")
export class MathObjectTest {
	testType = "unit"

	@Scenario("Default addition (2 + 3)")
	static async defaultAddition(input = {}, assert: AssertFn, waitFor: WaitForFn) {
		const sum = MathObject.add(2, 3)
		assert(sum === 5, "Expected sum to be 5")
	}

	@Scenario("Changed inputs (10 + 7)")
	static async changedInputs(input: { a?: number; b?: number } = {}, assert: AssertFn, waitFor: WaitForFn) {
		const a = input.a ?? 10
		const b = input.b ?? 7
		const sum = MathObject.add(a, b)
		assert(sum === 17, "Expected sum to be 17")
	}
}
