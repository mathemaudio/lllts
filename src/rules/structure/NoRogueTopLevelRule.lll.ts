import { Statement, SyntaxKind } from "ts-morph"
import { BaseRule } from "../../core/BaseRule.lll"
import { Rule } from "../../core/rulesEngine/Rule"
import { Spec } from "../../public/lll.lll"

@Spec("Forbids rogue top-level declarations; allows one final if, or one final new of exported class in production files.")
export class NoRogueTopLevelRule {
	@Spec("Returns the rule configuration object.")
	public static getRule(): Rule {
		return {
			id: "R6",
			title: "No rogue top-level declarations",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}
				if (NoRogueTopLevelRule.isLllPublicDecoratorsFile(filePath)) {
					return []
				}
				if (NoRogueTopLevelRule.isPureReExportBarrel(sourceFile)) {
					return []
				}

				const statements = sourceFile.getStatements()
				const diagnostics: import("../../core/DiagnosticObject").DiagnosticObject[] = []
				NoRogueTopLevelRule.validateTopLevelIfPlacement(filePath, statements, diagnostics)

				for (let index = 0; index < statements.length; index++) {
					const statement = statements[index]
					const kind = statement.getKind()
					const line = statement.getStartLineNumber()

					if (kind === SyntaxKind.FunctionDeclaration) {
						const functionDeclaration = statement.asKindOrThrow(SyntaxKind.FunctionDeclaration)
						const functionName = functionDeclaration.getName() ?? "(anonymous)"
						const visibilityHint = functionDeclaration.isExported()
							? "If this must be exported, make it a public static method on a class in this file."
							: "If this is internal, make it a private static method on a class in this file."
						diagnostics.push(
							BaseRule.createError(
								filePath,
								`Top-level function '${functionName}' is forbidden. ${visibilityHint}`,
								"rogue-top-level",
								line
							)
						)
						continue
					}

					if (kind === SyntaxKind.VariableStatement) {
						const variableStatement = statement.asKindOrThrow(SyntaxKind.VariableStatement)
						const declarationKind = variableStatement.getDeclarationKindKeywords()[0]?.getText() ?? "const"
						const visibilityHint = variableStatement.isExported()
							? "If this must be exported, move it to a public class property."
							: "If this is internal, move it to a private class property."
						for (const declaration of variableStatement.getDeclarations()) {
							diagnostics.push(
								BaseRule.createError(
									filePath,
									`Top-level ${declarationKind} '${declaration.getName()}' is forbidden. Move constants to static readonly class properties. ${visibilityHint}`,
									"rogue-top-level",
									line
								)
							)
						}
						continue
					}

					if (kind === SyntaxKind.EnumDeclaration) {
						const enumDeclaration = statement.asKindOrThrow(SyntaxKind.EnumDeclaration)
						const enumName = enumDeclaration.getName() ?? "(anonymous)"
						diagnostics.push(
							BaseRule.createError(
								filePath,
								`Top-level enum '${enumName}' is forbidden. Use a union type or static readonly class properties.`,
								"rogue-top-level",
								line
							)
						)
						continue
					}

					if (kind === SyntaxKind.ModuleDeclaration) {
						const moduleDeclaration = statement.asKindOrThrow(SyntaxKind.ModuleDeclaration)
						const moduleName = moduleDeclaration.getName() ?? "(anonymous)"
						diagnostics.push(
							BaseRule.createError(
								filePath,
								`Top-level namespace/module '${moduleName}' is forbidden in checked source files.`,
								"rogue-top-level",
								line
							)
						)
						continue
					}

					if (kind === SyntaxKind.IfStatement) {
						continue
					}

					if (kind === SyntaxKind.ExpressionStatement) {
						if (NoRogueTopLevelRule.isAllowedFinalClassInstantiationStatement(sourceFile, statement, statements)) {
							continue
						}
						if (NoRogueTopLevelRule.isAllowedSpecCallBeforeExportedType(statement, statements, index)) {
							continue
						}

						const expressionStatement = statement.asKindOrThrow(SyntaxKind.ExpressionStatement)
						const newExpression = expressionStatement.getExpression().asKind(SyntaxKind.NewExpression)
						if (newExpression !== undefined) {
							const message = filePath.endsWith(".test.lll.ts")
								? "Top-level class instantiation is forbidden in test files. Tests are instantiated automatically by the language."
								: "Top-level class instantiation is allowed only as the final statement in the exact form `new ClassName()` matching the exported class."
							diagnostics.push(
								BaseRule.createError(
									filePath,
									message,
									"rogue-top-level",
									line
								)
							)
							continue
						}
					}

					if (NoRogueTopLevelRule.isAllowedDeclarationKind(kind)) {
						if (NoRogueTopLevelRule.isDeclaredStatement(statement)) {
							diagnostics.push(
								BaseRule.createError(
									filePath,
									"Top-level 'declare' statements are forbidden in .ts files. Use .d.ts for ambient declarations.",
									"rogue-top-level",
									line
								)
							)
						}
						continue
					}

					if (NoRogueTopLevelRule.isDeclaredStatement(statement)) {
						diagnostics.push(
							BaseRule.createError(
								filePath,
								"Top-level 'declare' statements are forbidden in .ts files. Use .d.ts for ambient declarations.",
								"rogue-top-level",
								line
							)
						)
						continue
					}

					diagnostics.push(
						BaseRule.createError(
							filePath,
							"Top-level executable statements are restricted: allow only one final top-level if, or in production files one final `new ClassName()` statement.",
							"rogue-top-level",
							line
						)
					)
				}

				return diagnostics
			}
		}
	}

	@Spec("Checks if statement kind is a declaration that can exist at top level.")
	private static isAllowedDeclarationKind(kind: SyntaxKind): boolean {
		return kind === SyntaxKind.ImportDeclaration
			|| kind === SyntaxKind.ExportDeclaration
			|| kind === SyntaxKind.ClassDeclaration
			|| kind === SyntaxKind.TypeAliasDeclaration
			|| kind === SyntaxKind.InterfaceDeclaration
	}

	@Spec("Checks whether a statement has declare modifier.")
	private static isDeclaredStatement(statement: Statement): boolean {
		const withModifiers = statement as Statement & { getModifiers?: () => import("ts-morph").Node[] }
		const modifiers = withModifiers.getModifiers?.() ?? []
		return modifiers.some(modifier => modifier.getKind() === SyntaxKind.DeclareKeyword)
	}

	@Spec("Checks whether statement is the single allowed final top-level `new ExportedClass()` in non-test files.")
	private static isAllowedFinalClassInstantiationStatement(
		sourceFile: import("ts-morph").SourceFile,
		statement: Statement,
		statements: Statement[]
	): boolean {
		if (sourceFile.getFilePath().endsWith(".test.lll.ts")) {
			return false
		}

		if (statement !== statements[statements.length - 1]) {
			return false
		}

		const expressionStatement = statement.asKind(SyntaxKind.ExpressionStatement)
		const newExpression = expressionStatement?.getExpression().asKind(SyntaxKind.NewExpression)
		if (!newExpression) {
			return false
		}

		if (newExpression.getArguments().length !== 0) {
			return false
		}

		const exportedClass = BaseRule.getExportedClass(sourceFile)
		const exportedClassName = exportedClass?.getName()
		if (!exportedClassName) {
			return false
		}

		const constructedName = newExpression.getExpression().getText().trim()
		return constructedName === exportedClassName
	}

	@Spec("Checks whether statement is a top-level Spec(...) call immediately before an exported type alias.")
	private static isAllowedSpecCallBeforeExportedType(statement: Statement, statements: Statement[], index: number): boolean {
		const expressionStatement = statement.asKind(SyntaxKind.ExpressionStatement)
		const expression = expressionStatement?.getExpression()
		const callExpression = expression?.asKind(SyntaxKind.CallExpression)
		const callee = callExpression?.getExpression().asKind(SyntaxKind.Identifier)
		if (!callee || !["Spec", "spec"].includes(callee.getText())) {
			return false
		}

		const nextStatement = statements[index + 1]
		const nextTypeAlias = nextStatement?.asKind(SyntaxKind.TypeAliasDeclaration)
		return !!nextTypeAlias?.isExported()
	}

	@Spec("Validates one-final-if top-level rule.")
	private static validateTopLevelIfPlacement(
		filePath: string,
		statements: Statement[],
		diagnostics: import("../../core/DiagnosticObject").DiagnosticObject[]
	) {
		const topLevelIfStatements = statements
			.filter(statement => statement.getKind() === SyntaxKind.IfStatement)
			.map(statement => statement.asKindOrThrow(SyntaxKind.IfStatement))

		if (topLevelIfStatements.length === 0) {
			return
		}

		if (topLevelIfStatements.length > 1) {
			for (const extraIf of topLevelIfStatements.slice(1)) {
				diagnostics.push(
					BaseRule.createError(
						filePath,
						"Only one top-level if statement is allowed per file.",
						"rogue-top-level",
						extraIf.getStartLineNumber()
					)
				)
			}
		}

		const lastStatement = statements[statements.length - 1]
		if (topLevelIfStatements[0] !== lastStatement) {
			diagnostics.push(
				BaseRule.createError(
					filePath,
					"The single allowed top-level if statement must be the last top-level statement in the file.",
					"rogue-top-level",
					topLevelIfStatements[0].getStartLineNumber()
				)
			)
		}
	}

	@Spec("Detects files that only re-export from other modules (barrel files).")
	private static isPureReExportBarrel(sourceFile: import("ts-morph").SourceFile): boolean {
		const statements = sourceFile.getStatements()
		if (statements.length === 0) {
			return false
		}
		return statements.every(statement => {
			const exportDeclaration = statement.asKind(SyntaxKind.ExportDeclaration)
			return !!exportDeclaration?.getModuleSpecifier()
		})
	}

	@Spec("Checks whether file is the explicit decorators/public API exception.")
	private static isLllPublicDecoratorsFile(filePath: string): boolean {
		return filePath.endsWith("/lll.lll.ts") || filePath.endsWith("\\lll.lll.ts")
	}
}
