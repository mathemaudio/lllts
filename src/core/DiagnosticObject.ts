import { Severity } from "./Severity";
import { RuleCode } from "./RuleCode";


export type DiagnosticObject = {
	file: string;
	message: string;
	severity: Severity;
	line?: number;
	ruleCode: RuleCode;
}
