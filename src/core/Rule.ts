import { DiagnosticObject } from "./DiagnosticObject";


export type Rule = {
	id: string;
	title: string;
	run(sourceFile: import("ts-morph").SourceFile): DiagnosticObject[];
}
