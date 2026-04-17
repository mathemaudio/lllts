import { DiagnosticObject } from "../DiagnosticObject";
import type { RuleContext } from "./RuleContext";


export type Rule = {
	id: string;
	title: string;
	run(sourceFile: import("ts-morph").SourceFile, context?: RuleContext): DiagnosticObject[];
}
