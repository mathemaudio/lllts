import { Spec } from "../../public/lll.lll.js"
import { firstFunction, secondFunction, thirdFunction } from "./manyFunctions"

@Spec("Class using many functions.")
export class ClassUsingManyFunctions {
	@Spec("Uses many functions.")
	public static main(): string {
		const result = firstFunction() + secondFunction() + thirdFunction()
		console.log("ClassUsingManyFunctions:useManyFunctions", { result })
		return result
	}
}