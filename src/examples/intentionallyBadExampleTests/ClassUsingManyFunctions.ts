import { Out } from "../../public/lll.lll.js"
import { Spec } from "../../public/lll.lll.js"
import { firstFunction, secondFunction, thirdFunction } from "./manyFunctions"

@Spec("Class using many functions.")
export class ClassUsingManyFunctions {
	@Spec("Uses many functions.")
	@Out("result", "string")
	public static main() {
		const result = firstFunction() + secondFunction() + thirdFunction()
		console.log("ClassUsingManyFunctions:useManyFunctions", { result })
		return result
	}
}