import { Out } from "../public/lll.lll.js"
import { Spec } from "../public/lll.lll.js"

@Spec("Simple calculator demonstrating server-side LLLTS components.")
export class MathObject {
	@Spec("Adds two numbers and returns the result.")
	@Out("sum", "number")
	public static add(a: number, b: number) {
		const sum = a + b
		console.log("math:add", { a, b, sum })
		return sum
	}

	@Spec("Multiplies two numbers and returns the result.")
	@Out("product", "number")
	public static multiply(a: number, b: number) {
		const product = a * b
		console.log("math:multiply", { a, b, product })
		return product
	}

	@Spec("Demonstrates basic math operations.")
	public static main() {
		console.log("🧮 Math Engine Demo")
		const sum = MathObject.add(2, 3)
		console.log(`2 + 3 = ${sum}`)
		const product = MathObject.multiply(4, 5)
		console.log(`4 × 5 = ${product}`)
	}
}
