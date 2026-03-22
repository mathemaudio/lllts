import type { CaseOrDefaultClause, SwitchStatement } from "ts-morph"
import { Node, SyntaxKind } from "ts-morph"
import { BaseRule } from "../../core/BaseRule.lll"
import { Rule } from "../../core/rulesEngine/Rule"
import { Spec } from "../../public/lll.lll"

@Spec("Forbids switch fallthrough from clauses with executable statements.")
export class NoSwitchFallthroughRule {
	@Spec("Returns the rule configuration object.")
	public static getRule(): Rule {
		return {
			id: "R16",
			title: "No switch fallthrough",
			run(sourceFile) {
				const filePath = sourceFile.getFilePath()
				if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
					return []
				}

				const diagnostics: import("../../core/DiagnosticObject").DiagnosticObject[] = []
				const switchStatements = sourceFile.getDescendantsOfKind(SyntaxKind.SwitchStatement)

				for (const switchStatement of switchStatements) {
					diagnostics.push(...NoSwitchFallthroughRule.validateSwitch(filePath, switchStatement))
				}

				return diagnostics
			}
		}
	}

	@Spec("Returns diagnostics for non-final clauses with executable statements that can fall through.")
	private static validateSwitch(filePath: string, switchStatement: SwitchStatement): import('../../core/DiagnosticObject').DiagnosticObject[] {
		const diagnostics: import("../../core/DiagnosticObject").DiagnosticObject[] = []
		const clauses = switchStatement.getCaseBlock().getClauses()

		for (let index = 0; index < clauses.length - 1; index++) {
			const clause = clauses[index]
			if (NoSwitchFallthroughRule.clauseHasNoStatements(clause)) {
				continue
			}
			if (NoSwitchFallthroughRule.clauseTerminates(clause)) {
				continue
			}

			const clauseLabel = Node.isCaseClause(clause)
				? `case ${clause.getExpression().getText()}`
				: "default"
			diagnostics.push(
				BaseRule.createError(
					filePath,
					`Switch clause '${clauseLabel}' can fall through into the next clause. Terminate it with break, return, throw, or continue.`,
					"switch-fallthrough",
					clause.getStartLineNumber()
				)
			)
		}

		return diagnostics
	}

	@Spec("Checks whether the clause ends with a statement that cannot continue into the next clause.")
	private static clauseTerminates(clause: CaseOrDefaultClause): boolean {
		const statements = clause.getStatements()
		if (statements.length === 0) {
			return false
		}
		return NoSwitchFallthroughRule.statementTerminates(statements[statements.length - 1])
	}

	@Spec("Checks whether the clause is only a grouping label with no executable statements.")
	private static clauseHasNoStatements(clause: CaseOrDefaultClause): boolean {
		return clause.getStatements().length === 0
	}

	@Spec("Checks whether the statement prevents normal completion of the current switch clause.")
	private static statementTerminates(statement: import("ts-morph").Statement): boolean {
		const blockTerminates: (block: import("ts-morph").Node & { getStatements(): import("ts-morph").Statement[] }) => boolean = block => {
			const statements = block.getStatements()
			if (statements.length === 0) {
				return false
			}
			return statementTerminates(statements[statements.length - 1])
		}
		const statementTerminates: (current: import("ts-morph").Statement) => boolean = current => {
			if (
				Node.isBreakStatement(current)
				|| Node.isReturnStatement(current)
				|| Node.isThrowStatement(current)
				|| Node.isContinueStatement(current)
			) {
				return true
			}

			if (Node.isBlock(current)) {
				return blockTerminates(current)
			}

			if (Node.isIfStatement(current)) {
				const elseStatement = current.getElseStatement()
				if (elseStatement === undefined) {
					return false
				}
				return statementTerminates(current.getThenStatement()) && statementTerminates(elseStatement)
			}

			if (Node.isTryStatement(current)) {
				const finallyBlock = current.getFinallyBlock()
				if (finallyBlock !== undefined) {
					return blockTerminates(finallyBlock)
				}
				const catchClause = current.getCatchClause()
				if (catchClause === undefined) {
					return false
				}
				return blockTerminates(current.getTryBlock()) && blockTerminates(catchClause.getBlock())
			}

			return false
		}

		return statementTerminates(statement)
	}
}
