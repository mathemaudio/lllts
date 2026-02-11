
import { Severity } from "./Severity"
import { DiagnosticObject } from "./DiagnosticObject"
import { RuleCode } from "./RuleCode"
import { Out } from "../public/lll"
import { Spec } from "../public/lll"
import type { SourceFile, ClassDeclaration, Decorator, Node } from "ts-morph"

@Spec("Defines the Rule interface, Diagnostic structure, and utilities for all rules.")

export class BaseRule {
	@Spec("Helper to create a diagnostic object.")

	@Out("diagnostic", "Diagnostic")
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

	@Out("filtered", "Diagnostic[]")
	public static filterBySeverity(diagnostics: DiagnosticObject[], sev: Severity) {
		return diagnostics.filter(d => d.severity === sev)
	}

	@Spec("Returns the first exported class from a source file, or undefined if nlll exists.")

	@Out("class", "ClassDeclaration | undefined")
	public static getExportedClass(sourceFile: SourceFile): ClassDeclaration | undefined {
		return sourceFile.getClasses().find(c => c.isExported())
	}

	@Spec("Finds a decorator by name on a given node.")

	@Out("decorator", "Decorator | undefined")
	public static findDecorator(node: Node & { getDecorators(): Decorator[] }, decoratorName: string): Decorator | undefined {
		return node.getDecorators().find(d => d.getName() === decoratorName)
	}

	@Spec("Checks if a node has a specific decorator.")

	@Out("hasDecorator", "boolean")
	public static hasDecorator(node: Node & { getDecorators(): Decorator[] }, decoratorName: string) {
		return node.getDecorators().some(d => d.getName() === decoratorName)
	}

	@Spec("Gets the arguments from a decorator as text array.")

	@Out("args", "string[]")
	public static getDecoratorArguments(decorator: Decorator) {
		return decorator.getArguments().map(arg => arg.getText())
	}

	@Spec("Helper to create an error diagnostic object.")

	@Out("diagnostic", "DiagnosticObject")
	public static createError(file: string, message: string, ruleCode: RuleCode, line?: number): DiagnosticObject {
		return this.createDiagnostic(file, message, "error", ruleCode, line)
	}

	@Spec("Helper to create a warning diagnostic object.")

	@Out("diagnostic", "DiagnosticObject")
	public static createWarning(file: string, message: string, ruleCode: RuleCode, line?: number): DiagnosticObject {
		return this.createDiagnostic(file, message, "warning", ruleCode, line)
	}

	@Spec("Helper to create a notice-level diagnostic object.")
	@Out("diagnostic", "DiagnosticObject")
	public static createNotice(file: string, message: string, ruleCode: RuleCode, line?: number): DiagnosticObject {
		return this.createDiagnostic(file, message, "notice", ruleCode, line)
	}
}
