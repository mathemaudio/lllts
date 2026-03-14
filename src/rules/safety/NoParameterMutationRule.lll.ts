import { Rule } from "../../core/rulesEngine/Rule"
import { BaseRule } from "../../core/BaseRule.lll"
import { Out, Spec } from "../../public/lll.lll"
import { Node, SyntaxKind } from "ts-morph"
import type {
	ArrayBindingPattern,
	ArrowFunction,
	BinaryExpression,
	ConstructorDeclaration,
	Expression,
	FunctionDeclaration,
	FunctionExpression,
	Identifier,
	MethodDeclaration,
	ObjectBindingPattern,
	ParameterDeclaration,
	PostfixUnaryExpression,
	PrefixUnaryExpression,
	SourceFile
} from "ts-morph"

@Spec("Forbids reassignment or update of function parameter bindings.")
export class NoParameterMutationRule {
	@Spec("Returns the rule configuration object.")
	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R19",
			title: "No parameter mutation",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../../core/DiagnosticObject").DiagnosticObject[] = []
				const functions = NoParameterMutationRule.collectFunctionLikeDeclarations(sourceFile)

				for (const currentFunction of functions) {
					diagnostics.push(...NoParameterMutationRule.validateFunction(filePath, currentFunction))
				}

				return diagnostics
			}
		}
	}

	@Spec("Collects function-like declarations with bodies that can contain parameter mutations.")
	@Out("functions", "object[]")
	private static collectFunctionLikeDeclarations(sourceFile: SourceFile) {
		const functions: Array<MethodDeclaration | FunctionDeclaration | FunctionExpression | ArrowFunction | ConstructorDeclaration> = []
		const addIfWithBody = (candidate: MethodDeclaration | FunctionDeclaration | FunctionExpression | ArrowFunction | ConstructorDeclaration) => {
			if (candidate.getBody() === undefined) {
				return
			}
			functions.push(candidate)
		}

		for (const methodDeclaration of sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration)) {
			addIfWithBody(methodDeclaration)
		}
		for (const functionDeclaration of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)) {
			addIfWithBody(functionDeclaration)
		}
		for (const functionExpression of sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression)) {
			addIfWithBody(functionExpression)
		}
		for (const arrowFunction of sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction)) {
			addIfWithBody(arrowFunction)
		}
		for (const constructorDeclaration of sourceFile.getDescendantsOfKind(SyntaxKind.Constructor)) {
			addIfWithBody(constructorDeclaration)
		}

		return functions
	}

	@Spec("Returns diagnostics for mutated parameter bindings inside one function-like declaration.")
	@Out("diagnostics", "import('../../core/DiagnosticObject').DiagnosticObject[]")
	private static validateFunction(
		filePath: string,
		currentFunction: MethodDeclaration | FunctionDeclaration | FunctionExpression | ArrowFunction | ConstructorDeclaration
	) {
		const parameterBindings = NoParameterMutationRule.collectParameterBindings(currentFunction.getParameters())
		if (parameterBindings.length === 0) {
			return []
		}

		const diagnostics: import("../../core/DiagnosticObject").DiagnosticObject[] = []
		const seenKeys = new Set<string>()
		const assignments = currentFunction.getDescendantsOfKind(SyntaxKind.BinaryExpression)
		for (const assignment of assignments) {
			if (!NoParameterMutationRule.belongsToCurrentFunction(assignment, currentFunction)) {
				continue
			}
			if (!NoParameterMutationRule.isAssignmentExpression(assignment)) {
				continue
			}
			for (const identifier of NoParameterMutationRule.collectAssignedIdentifiers(assignment.getLeft())) {
				const parameterName = NoParameterMutationRule.getMatchingParameterName(identifier, parameterBindings)
				if (parameterName === undefined) {
					continue
				}
				const key = `${assignment.getStart()}-${parameterName}`
				if (seenKeys.has(key)) {
					continue
				}
				seenKeys.add(key)
				diagnostics.push(
					BaseRule.createError(
						filePath,
						NoParameterMutationRule.buildAssignmentMessage(parameterName, assignment),
						"no-parameter-mutation",
						assignment.getStartLineNumber()
					)
				)
			}
		}

		for (const updateExpression of currentFunction.getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression)) {
			if (!NoParameterMutationRule.belongsToCurrentFunction(updateExpression, currentFunction)) {
				continue
			}
			if (!NoParameterMutationRule.isUpdateExpression(updateExpression)) {
				continue
			}
			const operand = updateExpression.getOperand()
			if (!Node.isIdentifier(operand)) {
				continue
			}
			const parameterName = NoParameterMutationRule.getMatchingParameterName(operand, parameterBindings)
			if (parameterName === undefined) {
				continue
			}
			const key = `${updateExpression.getStart()}-${parameterName}`
			if (seenKeys.has(key)) {
				continue
			}
			seenKeys.add(key)
			diagnostics.push(
				BaseRule.createError(
					filePath,
					NoParameterMutationRule.buildUpdateMessage(parameterName, updateExpression.getText()),
					"no-parameter-mutation",
					updateExpression.getStartLineNumber()
				)
			)
		}

		for (const updateExpression of currentFunction.getDescendantsOfKind(SyntaxKind.PostfixUnaryExpression)) {
			if (!NoParameterMutationRule.belongsToCurrentFunction(updateExpression, currentFunction)) {
				continue
			}
			const operand = updateExpression.getOperand()
			if (!Node.isIdentifier(operand)) {
				continue
			}
			const parameterName = NoParameterMutationRule.getMatchingParameterName(operand, parameterBindings)
			if (parameterName === undefined) {
				continue
			}
			const key = `${updateExpression.getStart()}-${parameterName}`
			if (seenKeys.has(key)) {
				continue
			}
			seenKeys.add(key)
			diagnostics.push(
				BaseRule.createError(
					filePath,
					NoParameterMutationRule.buildUpdateMessage(parameterName, updateExpression.getText()),
					"no-parameter-mutation",
					updateExpression.getStartLineNumber()
				)
			)
		}

		return diagnostics
	}

	@Spec("Checks whether the mutation belongs to the current function instead of a nested function.")
	@Out("belongs", "boolean")
	private static belongsToCurrentFunction(
		node: BinaryExpression | PrefixUnaryExpression | PostfixUnaryExpression,
		currentFunction: MethodDeclaration | FunctionDeclaration | FunctionExpression | ArrowFunction | ConstructorDeclaration
	) {
		const owner = node.getFirstAncestor(ancestor =>
			Node.isMethodDeclaration(ancestor)
			|| Node.isFunctionDeclaration(ancestor)
			|| Node.isFunctionExpression(ancestor)
			|| Node.isArrowFunction(ancestor)
			|| Node.isConstructorDeclaration(ancestor)
		)
		return owner === currentFunction
	}

	@Spec("Collects identifier bindings introduced by function parameters, including destructuring names.")
	@Out("bindings", "Identifier[]")
	private static collectParameterBindings(parameters: ParameterDeclaration[]) {
		const bindings: Identifier[] = []

		for (const parameter of parameters) {
			const nameNode = parameter.getNameNode()
			if (Node.isIdentifier(nameNode)) {
				bindings.push(nameNode)
				continue
			}
			if (Node.isObjectBindingPattern(nameNode) || Node.isArrayBindingPattern(nameNode)) {
				bindings.push(...NoParameterMutationRule.collectBindingIdentifiers(nameNode))
			}
		}

		return bindings
	}

	@Spec("Collects identifiers declared inside a binding pattern.")
	@Out("identifiers", "Identifier[]")
	private static collectBindingIdentifiers(bindingPattern: ObjectBindingPattern | ArrayBindingPattern) {
		return bindingPattern.getDescendantsOfKind(SyntaxKind.Identifier)
	}

	@Spec("Checks whether a binary expression uses an assignment operator.")
	@Out("assignment", "boolean")
	private static isAssignmentExpression(binaryExpression: BinaryExpression) {
		const operatorKind = binaryExpression.getOperatorToken().getKind()
		return operatorKind === SyntaxKind.EqualsToken
			|| operatorKind === SyntaxKind.PlusEqualsToken
			|| operatorKind === SyntaxKind.MinusEqualsToken
			|| operatorKind === SyntaxKind.AsteriskEqualsToken
			|| operatorKind === SyntaxKind.AsteriskAsteriskEqualsToken
			|| operatorKind === SyntaxKind.SlashEqualsToken
			|| operatorKind === SyntaxKind.PercentEqualsToken
			|| operatorKind === SyntaxKind.LessThanLessThanEqualsToken
			|| operatorKind === SyntaxKind.GreaterThanGreaterThanEqualsToken
			|| operatorKind === SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken
			|| operatorKind === SyntaxKind.AmpersandEqualsToken
			|| operatorKind === SyntaxKind.BarEqualsToken
			|| operatorKind === SyntaxKind.CaretEqualsToken
			|| operatorKind === SyntaxKind.BarBarEqualsToken
			|| operatorKind === SyntaxKind.AmpersandAmpersandEqualsToken
			|| operatorKind === SyntaxKind.QuestionQuestionEqualsToken
	}

	@Spec("Collects identifiers directly rebound by the left-hand side of an assignment.")
	@Out("identifiers", "Identifier[]")
	private static collectAssignedIdentifiers(leftExpression: Expression) {
		if (Node.isIdentifier(leftExpression)) {
			return [leftExpression]
		}
		if (Node.isArrayLiteralExpression(leftExpression) || Node.isObjectLiteralExpression(leftExpression)) {
			return leftExpression.getDescendantsOfKind(SyntaxKind.Identifier)
		}
		return []
	}

	@Spec("Returns the matching parameter binding name when the identifier refers to a parameter.")
	@Out("parameterName", "string | undefined")
	private static getMatchingParameterName(identifier: Identifier, parameterBindings: Identifier[]) {
		const identifierSymbol = identifier.getSymbol()
		if (identifierSymbol === undefined) {
			return undefined
		}
		const identifierDeclarationKeys = new Set(
			identifierSymbol.getDeclarations().map(declaration => `${declaration.getSourceFile().getFilePath()}:${declaration.getStart()}`)
		)

		for (const parameterBinding of parameterBindings) {
			const parameterKey = `${parameterBinding.getSourceFile().getFilePath()}:${parameterBinding.getStart()}`
			if (identifierDeclarationKeys.has(parameterKey)) {
				return parameterBinding.getText()
			}
		}

		return undefined
	}

	@Spec("Checks whether a prefix unary expression updates its operand.")
	@Out("update", "boolean")
	private static isUpdateExpression(prefixUnaryExpression: PrefixUnaryExpression) {
		const operatorKind = prefixUnaryExpression.getOperatorToken()
		return operatorKind === SyntaxKind.PlusPlusToken || operatorKind === SyntaxKind.MinusMinusToken
	}

	@Spec("Builds a diagnostic message for assignment-style parameter mutation.")
	@Out("message", "string")
	private static buildAssignmentMessage(parameterName: string, assignment: BinaryExpression) {
		const operator = assignment.getOperatorToken().getText()
		return `Parameter '${parameterName}' is reassigned with '${operator}'. Create a new local variable instead of mutating the parameter binding.`
	}

	@Spec("Builds a diagnostic message for increment and decrement parameter mutation.")
	@Out("message", "string")
	private static buildUpdateMessage(parameterName: string, expressionText: string) {
		return `Parameter '${parameterName}' is updated by '${expressionText}'. Create a new local variable instead of mutating the parameter binding.`
	}
}
