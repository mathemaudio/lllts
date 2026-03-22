
import type { ClassDeclaration, Decorator, Node, SourceFile } from "ts-morph"
import { Spec } from "../public/lll.lll"
import { DiagnosticObject } from "./DiagnosticObject"
import { Severity } from "./Severity"
import { RuleCode } from "./rulesEngine/RuleCode"

@Spec("Defines the Rule interface, Diagnostic structure, and utilities for all rules.")

export class BaseRule {
	@Spec("Helper to create a diagnostic object.")
	public static createDiagnostic(
		file: string,
		message: string,
		severity: Severity,
		ruleCode: RuleCode,
		line?: number
	): DiagnosticObject {
		return { file, message, severity, line, ruleCode }
	}

	@Spec("Filters diagnostics by severity level.")
	public static filterBySeverity(diagnostics: DiagnosticObject[], sev: Severity): DiagnosticObject[] {
		return diagnostics.filter(d => d.severity === sev)
	}

	@Spec("Returns the first exported class from a source file, or undefined if nlll exists.")
	public static getExportedClass(sourceFile: SourceFile): ClassDeclaration | undefined {
		return sourceFile.getClasses().find(c => c.isExported())
	}

	@Spec("Finds a decorator by name on a given node.")
	public static findDecorator(node: Node & { getDecorators(): Decorator[] }, decoratorName: string): Decorator | undefined {
		return node.getDecorators().find(d => d.getName() === decoratorName)
	}

	@Spec("Checks if a node has a specific decorator.")
	public static hasDecorator(node: Node & { getDecorators(): Decorator[] }, decoratorName: string): boolean {
		return node.getDecorators().some(d => d.getName() === decoratorName)
	}

	@Spec("Gets the arguments from a decorator as text array.")
	public static getDecoratorArguments(decorator: Decorator): string[] {
		return decorator.getArguments().map(arg => arg.getText())
	}

	@Spec("Helper to create an error diagnostic object.")
	public static createError(file: string, message: string, ruleCode: RuleCode, line?: number): DiagnosticObject {
		return this.createDiagnostic(file, message, "error", ruleCode, line)
	}

	@Spec("Helper to create a warning diagnostic object.")
	public static createWarning(file: string, message: string, ruleCode: RuleCode, line?: number): DiagnosticObject {
		return this.createDiagnostic(file, message, "warning", ruleCode, line)
	}

	@Spec("Helper to create a notice-level diagnostic object.")
	public static createNotice(file: string, message: string, ruleCode: RuleCode, line?: number): DiagnosticObject {
		return this.createDiagnostic(file, message, "notice", ruleCode, line)
	}
}
