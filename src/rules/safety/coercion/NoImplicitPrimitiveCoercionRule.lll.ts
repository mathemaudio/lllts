import { Rule } from "../../../core/rulesEngine/Rule"
import { BaseRule } from "../../../core/BaseRule.lll"
import { Out } from "../../../public/lll.lll"
import { Spec } from "../../../public/lll.lll"
import { SyntaxKind, ts } from "ts-morph"
import type { PrefixUnaryExpression, SourceFile, Type } from "ts-morph"

@Spec("Forbids arithmetic operators when operands are not statically known to be numeric.")
export class NoImplicitPrimitiveCoercionRule {
	@Spec("Returns the rule configuration object.")
	@Out("rule", "Rule")
	public static getRule(): Rule {
		return {
			id: "R13",
			title: "No implicit primitive coercion",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../../../core/DiagnosticObject").DiagnosticObject[] = []
				diagnostics.push(...NoImplicitPrimitiveCoercionRule.collectBinaryOperatorDiagnostics(sourceFile, filePath))
				diagnostics.push(...NoImplicitPrimitiveCoercionRule.collectUnaryOperatorDiagnostics(sourceFile, filePath))
				return diagnostics
			}
		}
	}

	@Spec("Collects diagnostics for binary arithmetic operators whose operands are not both numeric.")
	@Out("diagnostics", "import('../../../core/DiagnosticObject').DiagnosticObject[]")
	private static collectBinaryOperatorDiagnostics(sourceFile: SourceFile, filePath: string) {
		const diagnostics: import("../../../core/DiagnosticObject").DiagnosticObject[] = []
		const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)

		for (const binaryExpression of binaryExpressions) {
			const operatorKind = binaryExpression.getOperatorToken().getKind()
			if (!NoImplicitPrimitiveCoercionRule.isCheckedBinaryOperator(operatorKind)) {
				continue
			}

			const left = binaryExpression.getLeft()
			const right = binaryExpression.getRight()
			const leftType = left.getType()
			const rightType = right.getType()
			if (
				NoImplicitPrimitiveCoercionRule.isStaticallyNumericType(leftType)
				&& NoImplicitPrimitiveCoercionRule.isStaticallyNumericType(rightType)
			) {
				continue
			}

			const operator = binaryExpression.getOperatorToken().getText()
			const leftTypeText = leftType.getText(left)
			const rightTypeText = rightType.getText(right)
			diagnostics.push(
				BaseRule.createError(
					filePath,
					`Arithmetic operator '${operator}' requires numeric operands. Found '${leftTypeText}' ${operator} '${rightTypeText}'. Convert explicitly before arithmetic.`,
					"no-implicit-primitive-coercion",
					binaryExpression.getStartLineNumber()
				)
			)
		}

		return diagnostics
	}

	@Spec("Collects diagnostics for unary plus or minus when the operand is not statically numeric.")
	@Out("diagnostics", "import('../../../core/DiagnosticObject').DiagnosticObject[]")
	private static collectUnaryOperatorDiagnostics(sourceFile: SourceFile, filePath: string) {
		const diagnostics: import("../../../core/DiagnosticObject").DiagnosticObject[] = []
		const unaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.PrefixUnaryExpression)

		for (const unaryExpression of unaryExpressions) {
			if (!NoImplicitPrimitiveCoercionRule.isCheckedUnaryOperator(unaryExpression)) {
				continue
			}

			const operand = unaryExpression.getOperand()
			const operandType = operand.getType()
			if (NoImplicitPrimitiveCoercionRule.isStaticallyNumericType(operandType)) {
				continue
			}

			const operator = NoImplicitPrimitiveCoercionRule.getUnaryOperatorText(unaryExpression)
			const operandTypeText = operandType.getText(operand)
			diagnostics.push(
				BaseRule.createError(
					filePath,
					`Unary operator '${operator}' requires a numeric operand. Found '${operandTypeText}'. Convert explicitly before arithmetic.`,
					"no-implicit-primitive-coercion",
					unaryExpression.getStartLineNumber()
				)
			)
		}

		return diagnostics
	}

	@Spec("Checks whether a binary operator is one of the arithmetic operators covered by this rule.")
	@Out("checked", "boolean")
	private static isCheckedBinaryOperator(operatorKind: SyntaxKind) {
		return operatorKind === SyntaxKind.MinusToken
			|| operatorKind === SyntaxKind.AsteriskToken
			|| operatorKind === SyntaxKind.SlashToken
			|| operatorKind === SyntaxKind.PercentToken
	}

	@Spec("Checks whether a prefix unary expression uses unary plus or unary minus.")
	@Out("checked", "boolean")
	private static isCheckedUnaryOperator(unaryExpression: PrefixUnaryExpression) {
		const operatorKind = unaryExpression.getOperatorToken()
		return operatorKind === SyntaxKind.PlusToken || operatorKind === SyntaxKind.MinusToken
	}

	@Spec("Returns the source-text operator symbol for a checked unary arithmetic expression.")
	@Out("operator", "string")
	private static getUnaryOperatorText(unaryExpression: PrefixUnaryExpression) {
		return unaryExpression.getOperatorToken() === SyntaxKind.PlusToken ? "+" : "-"
	}

	@Spec("Returns true when the provided type is statically numeric, including numeric unions and branded numbers.")
	@Out("numeric", "boolean")
	private static isStaticallyNumericType(type: Type) {
		const pending = [type]
		const visited = new Set<Type>()

		while (pending.length > 0) {
			const current = pending.pop()!
			if (visited.has(current)) {
				continue
			}
			visited.add(current)

			if (NoImplicitPrimitiveCoercionRule.hasNumericFlags(current)) {
				continue
			}
			if (current.isUnion()) {
				const unionTypes = current.getUnionTypes()
				if (unionTypes.length === 0) {
					return false
				}
				pending.push(...unionTypes)
				continue
			}
			if (current.isIntersection()) {
				const intersectionTypes = current.getIntersectionTypes()
				if (intersectionTypes.length === 0) {
					return false
				}
				if (intersectionTypes.some(intersectionType => NoImplicitPrimitiveCoercionRule.hasNumericFlags(intersectionType))) {
					continue
				}
				const nestedIntersectionTypes = intersectionTypes.filter(intersectionType => intersectionType.isUnion() || intersectionType.isIntersection())
				if (nestedIntersectionTypes.length === 0) {
					return false
				}
				pending.push(...nestedIntersectionTypes)
				continue
			}
			return false
		}

		return true
	}

	@Spec("Checks numeric-related TypeScript flags for primitive numbers, literals, and numeric enums.")
	@Out("numeric", "boolean")
	private static hasNumericFlags(type: Type) {
		const flags = type.getFlags()
		const numericFlags = ts.TypeFlags.Number
			| ts.TypeFlags.NumberLiteral
			| ts.TypeFlags.Enum
			| ts.TypeFlags.EnumLiteral
		return (flags & numericFlags) !== 0
	}
}
