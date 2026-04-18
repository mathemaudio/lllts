import type { ArrayLiteralExpression, CallExpression, Expression, FunctionDeclaration, FunctionExpression, Identifier, MethodDeclaration, Node as MorphNode, SourceFile, Type } from "ts-morph"
import { Node, SyntaxKind, ts } from "ts-morph"
import { BaseRule } from "../../../core/BaseRule.lll"
import { Rule } from "../../../core/rulesEngine/Rule"
import { Spec } from "../../../public/lll.lll"

@Spec("Forbids promise values created inside async functions from floating without await, return, or Promise combinator handling.")
export class NoFloatingPromisesRule {
	private static readonly async_function_kinds = ["method", "function", "function-expression", "arrow-function"] as const
	private static readonly tracked_value_kinds = ["promise", "promise-collection"] as const

	@Spec("Returns the rule configuration object.")
	public static getRule(): Rule {
		return {
			id: "R18",
			title: "No floating promises in async code",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../../../core/DiagnosticObject").DiagnosticObject[] = []
				const asyncFunctions = NoFloatingPromisesRule.collectAsyncFunctions(sourceFile)

				for (const asyncFunction of asyncFunctions) {
					diagnostics.push(...NoFloatingPromisesRule.validateAsyncFunction(filePath, asyncFunction))
				}

				return diagnostics
			}
		}
	}

	@Spec("Collects async function-like declarations with block bodies.")
	private static collectAsyncFunctions(sourceFile: SourceFile): Array<MethodDeclaration | FunctionDeclaration | FunctionExpression | import("ts-morph").ArrowFunction> {
		const asyncFunctions: Array<MethodDeclaration | FunctionDeclaration | FunctionExpression | import("ts-morph").ArrowFunction> = []
		const addIfAsync = (candidate: MethodDeclaration | FunctionDeclaration | FunctionExpression | import("ts-morph").ArrowFunction) => {
			if (!candidate.isAsync()) {
				return
			}
			if (candidate.getBody() === undefined) {
				return
			}
			asyncFunctions.push(candidate)
		}

		for (const methodDeclaration of sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration)) {
			addIfAsync(methodDeclaration)
		}
		for (const functionDeclaration of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
			addIfAsync(functionDeclaration)
		}
		for (const functionExpression of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression)) {
			addIfAsync(functionExpression)
		}
		for (const arrowFunction of sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction)) {
			addIfAsync(arrowFunction)
		}

		return asyncFunctions
	}

	@Spec("Returns diagnostics for floating promise values declared inside an async function.")
	private static validateAsyncFunction(filePath: string, asyncFunction: MethodDeclaration | FunctionDeclaration | FunctionExpression | import("ts-morph").ArrowFunction): import('../../../core/DiagnosticObject').DiagnosticObject[] {
		const diagnostics: import("../../../core/DiagnosticObject").DiagnosticObject[] = []
		const trackedDeclarations = NoFloatingPromisesRule.collectTrackedDeclarations(asyncFunction)

		for (const trackedDeclaration of trackedDeclarations) {
			if (NoFloatingPromisesRule.isTrackedDeclarationHandled(trackedDeclaration.nameNode, asyncFunction)) {
				continue
			}

			const kindLabel = trackedDeclaration.kind === "promise"
				? "Promise value"
				: "Collection of promises"
			diagnostics.push(
				BaseRule.createError(
					filePath,
					`${kindLabel} '${trackedDeclaration.nameNode.getText()}' floats inside async code. Await it, return it, pass it to Promise.all/Promise.allSettled/Promise.race/Promise.any, or explicitly discard it with 'void'.`,
					"no-floating-promises",
					trackedDeclaration.expression.getStartLineNumber()
				)
			)
		}

		return diagnostics
	}

	@Spec("Collects variable declarations in the current async function whose initializer is a promise or a collection of promises.")
	private static collectTrackedDeclarations(asyncFunction: MethodDeclaration | FunctionDeclaration | FunctionExpression | import("ts-morph").ArrowFunction): Array<{
		expression: Expression
		kind: (typeof NoFloatingPromisesRule.tracked_value_kinds)[number]
		nameNode: Identifier
	}> {
		const body = asyncFunction.getBody()
		if (body === undefined || !Node.isBlock(body)) {
			return []
		}

		const tracked: Array<{
			expression: Expression
			kind: (typeof NoFloatingPromisesRule.tracked_value_kinds)[number]
			nameNode: Identifier
		}> = []

		for (const variableDeclaration of body.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
			if (!NoFloatingPromisesRule.belongsToFunction(variableDeclaration, asyncFunction)) {
				continue
			}
			const nameNode = variableDeclaration.getNameNode()
			if (!Node.isIdentifier(nameNode)) {
				continue
			}
			const initializer = variableDeclaration.getInitializer()
			if (initializer === undefined) {
				continue
			}
			const trackedKind = NoFloatingPromisesRule.getTrackedValueKind(initializer)
			if (trackedKind === undefined) {
				continue
			}
			tracked.push({
				expression: initializer,
				kind: trackedKind,
				nameNode
			})
		}

		return tracked
	}

	@Spec("Returns the tracked kind when an expression evaluates to a Promise or collection of promises.")
	private static getTrackedValueKind(expression: Expression): 'promise' | 'promise-collection' | undefined {
		if (Node.isAwaitExpression(expression) || Node.isVoidExpression(expression)) {
			return undefined
		}
		const type = expression.getType()
		if (NoFloatingPromisesRule.isPromiseLikeType(type, expression)) {
			return "promise"
		}
		if (NoFloatingPromisesRule.isPromiseCollectionType(type, expression)) {
			return "promise-collection"
		}
		if (Node.isArrayLiteralExpression(expression) && NoFloatingPromisesRule.arrayLiteralContainsPromiseLike(expression)) {
			return "promise-collection"
		}
		return undefined
	}

	@Spec("Checks whether the tracked declaration is later awaited, returned, voided, or combined explicitly inside the same async function.")
	private static isTrackedDeclarationHandled(nameNode: Identifier, asyncFunction: MethodDeclaration | FunctionDeclaration | FunctionExpression | import("ts-morph").ArrowFunction): boolean {
		const references = nameNode.findReferencesAsNodes()
			.filter(reference => reference !== nameNode)
			.filter(reference => NoFloatingPromisesRule.belongsToFunction(reference, asyncFunction))

		if (references.length === 0) {
			return false
		}

		return references.some(reference => NoFloatingPromisesRule.isHandledReference(reference))
	}

	@Spec("Checks whether the reference participates in an explicit handling pattern.")
	private static isHandledReference(reference: MorphNode): boolean {
		let current: MorphNode | undefined = reference

		while (current !== undefined) {
			const parent = current.getParent()
			if (parent === undefined) {
				return false
			}

			if (Node.isParenthesizedExpression(parent)) {
				current = parent
				continue
			}

			if (Node.isAwaitExpression(parent) || Node.isReturnStatement(parent) || Node.isVoidExpression(parent)) {
				return true
			}

			if (Node.isCallExpression(parent) && NoFloatingPromisesRule.isExplicitPromiseHandlingCall(parent, current)) {
				return true
			}

			if (Node.isArrayLiteralExpression(parent) && NoFloatingPromisesRule.isPromiseCollectionHandler(parent)) {
				return true
			}

			if (Node.isSpreadElement(parent) || Node.isAsExpression(parent) || Node.isNonNullExpression(parent)) {
				current = parent
				continue
			}

			if (Node.isPropertyAccessExpression(parent)) {
				const grandParent = parent.getParent()
				if (grandParent !== undefined && Node.isCallExpression(grandParent) && grandParent.getExpression() === parent) {
					current = parent
					continue
				}
				return false
			}

			return false
		}

		return false
	}

	@Spec("Checks whether a call expression explicitly handles a promise or a promise collection.")
	private static isExplicitPromiseHandlingCall(callExpression: CallExpression, current: MorphNode): boolean {
		if (NoFloatingPromisesRule.isPromiseCombinatorCall(callExpression) && callExpression.getArguments().includes(current as Expression)) {
			return true
		}

		const callee = callExpression.getExpression()
		if (!Node.isPropertyAccessExpression(callee)) {
			return false
		}

		const methodName = callee.getName()
		if (methodName === "catch" && callExpression.getArguments().length >= 1) {
			return current === callee.getExpression()
		}
		if (methodName === "then" && callExpression.getArguments().length >= 2) {
			return current === callee.getExpression()
		}

		return false
	}

	@Spec("Checks whether an array literal is directly supplied to a Promise combinator call.")
	private static isPromiseCollectionHandler(arrayLiteralExpression: ArrayLiteralExpression): boolean {
		const parent = arrayLiteralExpression.getParent()
		if (parent === undefined) {
			return false
		}
		return Node.isCallExpression(parent) && NoFloatingPromisesRule.isPromiseCombinatorCall(parent)
	}

	@Spec("Checks whether the call expression is Promise.all, Promise.allSettled, Promise.any, or Promise.race.")
	private static isPromiseCombinatorCall(callExpression: CallExpression): boolean {
		const callee = callExpression.getExpression()
		if (!Node.isPropertyAccessExpression(callee)) {
			return false
		}
		if (callee.getExpression().getText() !== "Promise") {
			return false
		}

		const methodName = callee.getName()
		return methodName === "all"
			|| methodName === "allSettled"
			|| methodName === "any"
			|| methodName === "race"
	}

	@Spec("Checks whether the current node belongs to the target function instead of a nested function.")
	private static belongsToFunction(node: MorphNode, asyncFunction: MethodDeclaration | FunctionDeclaration | FunctionExpression | import("ts-morph").ArrowFunction): boolean {
		return NoFloatingPromisesRule.getOwningFunction(node) === asyncFunction
	}

	@Spec("Returns the nearest function-like ancestor that owns the node.")
	private static getOwningFunction(node: MorphNode): object | undefined {
		let current: MorphNode | undefined = node

		while (current !== undefined) {
			if (
				Node.isMethodDeclaration(current)
				|| Node.isFunctionDeclaration(current)
				|| Node.isFunctionExpression(current)
				|| Node.isArrowFunction(current)
			) {
				return current
			}
			current = current.getParent()
		}

		return undefined
	}

	@Spec("Returns true when the resolved type is or includes a Promise or PromiseLike value.")
	private static isPromiseLikeType(type: Type, expression: Expression): boolean {
		const pending = [type]
		const visited = new Set<Type>()

		while (pending.length > 0) {
			const current = pending.pop()
			if (current === undefined) {
				continue
			}
			if (visited.has(current)) {
				continue
			}
			visited.add(current)

			if (NoFloatingPromisesRule.hasPromiseLikeShape(current, expression)) {
				return true
			}
			if (current.isUnion()) {
				pending.push(...current.getUnionTypes())
				continue
			}
			if (current.isIntersection()) {
				pending.push(...current.getIntersectionTypes())
			}
		}

		return false
	}

	@Spec("Returns true when the resolved type is a collection whose element type includes a Promise or PromiseLike value.")
	private static isPromiseCollectionType(type: Type, expression: Expression): boolean {
		const pending = [type]
		const visited = new Set<Type>()

		while (pending.length > 0) {
			const current = pending.pop()
			if (current === undefined) {
				continue
			}
			if (visited.has(current)) {
				continue
			}
			visited.add(current)

			if (current.isUnion()) {
				pending.push(...current.getUnionTypes())
				continue
			}
			if (current.isIntersection()) {
				pending.push(...current.getIntersectionTypes())
			}

			const arrayElementType = current.getArrayElementType()
			if (arrayElementType !== undefined && NoFloatingPromisesRule.isPromiseLikeType(arrayElementType, expression)) {
				return true
			}

			if (current.isTuple()) {
				const tupleElements = current.getTupleElements()
				if (tupleElements.some(tupleElement => NoFloatingPromisesRule.isPromiseLikeType(tupleElement, expression))) {
					return true
				}
			}
		}

		return false
	}

	@Spec("Checks whether an array literal contains at least one promise-like element.")
	private static arrayLiteralContainsPromiseLike(arrayLiteralExpression: ArrayLiteralExpression): boolean {
		return arrayLiteralExpression.getElements().some(element => {
			if (!Node.isExpression(element)) {
				return false
			}
			return NoFloatingPromisesRule.isPromiseLikeType(element.getType(), element)
		})
	}

	@Spec("Checks for Promise flags, symbols, or a callable then method on the apparent type.")
	private static hasPromiseLikeShape(type: Type, expression: Expression): boolean {
		const flags = type.getFlags()
		if ((flags & ts.TypeFlags.Any) !== 0 || (flags & ts.TypeFlags.Unknown) !== 0) {
			return false
		}

		const symbolName = type.getSymbol()?.getName() ?? type.getAliasSymbol()?.getName()
		if (symbolName === "Promise" || symbolName === "PromiseLike") {
			return true
		}

		const text = type.getText(expression)
		if (text === "Promise" || text.startsWith("Promise<") || text === "PromiseLike" || text.startsWith("PromiseLike<")) {
			return true
		}

		const thenProperty = type.getApparentType().getProperty("then")
		if (thenProperty === undefined) {
			return false
		}
		const declaration = thenProperty.getValueDeclaration()
		if (declaration === undefined) {
			return true
		}
		const thenType = declaration.getType()
		return thenType.getCallSignatures().length > 0
	}
}
