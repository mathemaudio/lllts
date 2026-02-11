import { ProjectInitiator } from "./ProjectInitiator.lll"
import { DiagnosticObject } from "./DiagnosticObject"
import { Out } from "../public/lll"
import { Spec } from "../public/lll"
import { BaseRule } from "./BaseRule.lll"
import { RuleCode } from "./RuleCode"
import { ClassDeclaration, MethodDeclaration, SourceFile } from "ts-morph"
import * as fs from "fs"
import * as path from "path"
import * as util from "util"

type TsConfig = {
	compilerOptions?: {
		rootDir?: string
		outDir?: string
	}
}

type ScenarioMetadata = {
	id?: string
	title?: string
}

type ScenarioEntry = {
	method: MethodDeclaration
	metadata: ScenarioMetadata
}

type ScenarioReport = {
	id?: string
	title?: string
	name: string
	status: "passed" | "failed"
}

type UseCaseReport = {
	className: string
	filePath: string
	line: number
	scenarios: ScenarioReport[]
}

type UseCaseRunnerResult = {
	diagnostics: DiagnosticObject[]
	reports: UseCaseReport[]
}

type ScenarioContext = {
	className: string
	filePath: string
	scenarioMethodName: string
	scenarioName: string
	line: number
}

type Environment = "api" | "browser"
function populateFakeBrowserClassesForDecorators() {
	const browserClasses = [
		"Window", "Document", "Node", "Element", "HTMLElement", "HTMLDivElement", "HTMLSpanElement",
		"HTMLButtllllement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "HTMLOptillllement",
		"HTMLFormElement", "HTMLFieldSetElement", "HTMLLegendElement", "HTMLParagraphElement", "HTMLAnchorElement",
		"HTMLImageElement", "HTMLUListElement", "HTMLOListElement", "HTMLLIElement", "HTMLTableElement",
		"HTMLTableCaptillllement", "HTMLTableRowElement", "HTMLTableCellElement", "HTMLTableSectillllement",
		"HTMLHeadElement", "HTMLBodyElement", "HTMLTitleElement", "HTMLMetaElement", "HTMLBaseElement",
		"HTMLLinkElement", "HTMLScriptElement", "HTMLStyleElement", "HTMLIFrameElement", "HTMLSlotElement",
		"HTMLAudioElement", "HTMLVideoElement", "HTMLSourceElement", "HTMLTrackElement", "HTMLPictureElement",
		"HTMLCanvasElement", "HTMLMapElement", "HTMLAreaElement", "HTMLDialogElement", "HTMLDetailsElement",
		"HTMLSummaryElement", "HTMLProgressElement", "HTMLMeterElement", "HTMLTimeElement", "HTMLDataElement",
		"HTMLQuoteElement", "HTMLBlockQuoteElement", "HTMLBRElement", "HTMLEmbedElement", "HTMLObjectElement",
		"HTMLParamElement", "HTMLTemplateElement", "HTMLDListElement", "HTMLDirectoryElement", "HTMLMenuElement",
		"HTMLMenuItemElement", "HTMLQuoteElement", "HTMLPictureElement", "HTMLSlotElement", "HTMLCanvasElement",
		"HTMLContentElement", "HTMLShadowElement", "HTMLDetailsElement", "HTMLSummaryElement", "HTMLDialogElement",
		"HTMLMediaElement", "HTMLAudioElement", "HTMLVideoElement", "HTMLSourceElement", "HTMLTrackElement",
		"HTMLMeterElement", "HTMLProgressElement", "HTMLTimeElement", "HTMLHeadingElement", "HTMLHRElement",
		"HTMLModElement", "HTMLMeterElement", "HTMLParagraphElement", "HTMLPreElement", "HTMLScriptElement",
		"HTMLStyleElement", "HTMLTitleElement", "HTMLLegendElement", "HTMLFieldSetElement", "HTMLFormElement",
		"HTMLLabelElement", "HTMLInputElement", "HTMLKeygenElement", "HTMLObjectElement", "HTMLSelectElement",
		"HTMLSlotElement", "HTMLSourceElement", "HTMLTemplateElement", "HTMLTrackElement", "HTMLVideoElement",
		"SVGElement", "SVGSVGElement", "SVGGraphicsElement", "SVGGElement", "SVGRectElement", "SVGImageElement",
		"SVGPathElement", "SVGPolygllllement", "SVGPolylineElement", "SVGCircleElement", "SVGEllipseElement",
		"SVGLineElement", "SVGTextElement", "SVGPatternElement", "SVGMarkerElement", "SVGGradientElement",
		"SVGFilterElement", "SVGDefsElement", "SVGClipPathElement", "SVGMaskElement", "SVGForeignObjectElement",
		"SVGUseElement", "SVGSymbolElement", "SVGTitleElement", "SVGDescElement", "SpeechSynthesisUtterance",
		"MutationObserver", "IntersectionObserver", "ResizeObserver", "PerformanceObserver", "AbortController",
		"AbortSignal", "Crypto", "SubtleCrypto", "URL", "URLSearchParams", "History", "Location",
		"Navigator", "Screen", "DeviceMotilllvent", "DeviceOrientatilllvent", "MediaStream", "MediaStreamTrack",
		"MediaRecorder", "WebSocket", "EventSource", "Worker", "SharedWorker", "MessageChannel",
		"BroadcastChannel", "FileReader", "Blob", "File", "FormData", "DataTransfer", "DataTransferItem"
	]
	const target = globalThis as any
	for (const className of browserClasses) {
		target[className] = target[className] || {}
	}
}

populateFakeBrowserClassesForDecorators()

type Phase = "view" | "scenario"

@Spec("Executes scenario methods inside `_usecase` companions in deterministic API or (future) browser environments.")
export class UseCaseRunner {
	private readonly projectRoot: string
	private readonly rootDir: string
	private readonly outDir: string

	constructor(private loader: ProjectInitiator, tsconfigPath: string) {
		this.projectRoot = path.dirname(tsconfigPath)
		const config = this.loadTsConfig(tsconfigPath)
		this.rootDir = path.resolve(this.projectRoot, config.compilerOptions?.rootDir ?? "src")
		this.outDir = path.resolve(this.projectRoot, config.compilerOptions?.outDir ?? "dist")
	}

	@Spec("Executes every discovered `_usecase` companion and returns diagnostics.")

	@Out("result", "{ diagnostics: Diagnostic[]; reports: UseCaseReport[] }")
	public async runAll(): Promise<UseCaseRunnerResult> {
		const diagnostics: DiagnosticObject[] = []
		const reports: UseCaseReport[] = []
		const files = this.loader.getFiles()

		for (const file of files) {
			const exportedClass = BaseRule.getExportedClass(file)
			if (!exportedClass) continue

			const className = exportedClass.getName()
			if (!className || !className.endsWith("_usecase")) {
				continue
			}

			const relativeFile = this.toProjectRelativePath(file.getFilePath())
			const scenarioEntries = this.getScenarioMethods(exportedClass)
			if (scenarioEntries.length === 0) {
				continue
			}

			const runtimeClass = this.loadRuntimeClass(file, className)
			if (!runtimeClass) {
				diagnostics.push(this.createModuleDiagnostic(file.getFilePath(), className))
				continue
			}

			const environment = this.getEnvironmentLiteral(exportedClass)
			if (!environment) {
				diagnostics.push(this.createMissingEnvironmentDiagnostic(relativeFile, className, exportedClass.getStartLineNumber()))
				continue
			}

			if (environment === "browser") {
				diagnostics.push(this.createBrowserNotImplementedDiag(relativeFile, className, exportedClass.getStartLineNumber()))
				continue
			}

			const viewMethod = this.getViewMethod(exportedClass)
			if (environment === "api" && viewMethod) {
				diagnostics.push(this.createViewForbiddenDiag(relativeFile, className, viewMethod.getStartLineNumber()))
				continue
			}

			const report: UseCaseReport = {
				className,
				filePath: relativeFile,
				line: (viewMethod ?? exportedClass).getStartLineNumber(),
				scenarios: []
			}

			for (const entry of scenarioEntries) {
				const methodName = entry.method.getName()
				if (!methodName) {
					continue
				}
				const scenarioName = entry.metadata.title ?? entry.metadata.id ?? methodName
				const context: ScenarioContext = {
					className,
					filePath: relativeFile,
					scenarioMethodName: methodName,
					scenarioName,
					line: entry.method.getStartLineNumber()
				}

				const failure = await this.runScenarioApi(context, runtimeClass)
				report.scenarios.push({
					id: entry.metadata.id,
					title: entry.metadata.title,
					name: scenarioName,
					status: failure ? "failed" : "passed"
				})

				if (failure) {
					diagnostics.push(failure)
				}
			}

			reports.push(report)
		}

		return { diagnostics, reports }
	}

	@Spec("Reads compiler options for locating compiled files.")
	@Out("config", "TsConfig")
	private loadTsConfig(configPath: string) {
		const raw = fs.readFileSync(configPath, "utf-8")
		return JSON.parse(raw)
	}

	@Spec("Returns static scenario methods decorated with @Scenario.")

	@Out("scenarios", "MethodDeclaration[]")
	private getScenarioMethods(classDecl: ClassDeclaration) {
		return classDecl.getMethods()
			.filter(method => method.isStatic() && BaseRule.hasDecorator(method, "Scenario"))
			.map(method => ({
				method,
				metadata: this.getScenarioMetadata(method)
			}))
	}

	@Spec("Returns the static view() renderer if it exists.")

	@Out("view", "MethodDeclaration | undefined")
	private getViewMethod(classDecl: ClassDeclaration) {
		return classDecl.getStaticMethod("view")
	}

	@Spec("Reads environment literal from the source class.")
	@Out("environment", "Environment | null")
	private getEnvironmentLiteral(classDecl: ClassDeclaration): Environment | null {
		const envProp = classDecl.getProperties().find(prop => !prop.isStatic() && prop.getName() === "environment")
		const init = envProp?.getInitializer()
		const text = init?.getText().trim()
		const match = text ? /^['"`](api|browser)['"`]$/.exec(text) : null
		return (match?.[1] as Environment) ?? null
	}

	@Spec("Requires the compiled JS module and returns the exported class reference.")
	@Out("classRef", "any")
	private loadRuntimeClass(sourceFile: SourceFile, className: string) {
		const compiledPath = this.getCompiledPath(sourceFile.getFilePath())
		if (!compiledPath || !fs.existsSync(compiledPath)) {
			return null
		}

		const exports = require(compiledPath)
		return exports[className] ?? null
	}

	@Spec("Maps a source file path to its compiled JavaScript output.")

	@Out("compiledPath", "string | null")
	private getCompiledPath(sourcePath: string) {
		const relative = path.relative(this.rootDir, sourcePath)
		if (relative.startsWith("..")) {
			return null
		}
		const parsed = path.parse(relative)
		const compiledFile = path.join(this.outDir, parsed.dir, `${parsed.name}.js`)
		return compiledFile
	}

	@Spec("Executes a scenario method in API environment, returning diagnostic on failure.")

	@Out("diagnostic", "Diagnostic | null")
	private async runScenarioApi(context: ScenarioContext, runtimeClass: any) {
		const capturedLogs: string[] = []
		const restoreConsole = this.hookConsole(capturedLogs)
		const assert = this.createAssert()

		try {
			const scenarioFn = runtimeClass[context.scenarioMethodName]
			if (typeof scenarioFn !== "function") {
				return this.createMissingScenarioDiagnostic(context)
			}

			try {
				await scenarioFn.call(runtimeClass, undefined, assert)
			} catch (error) {
				return this.buildDiagnostic(context, "scenario", error, capturedLogs, "")
			}

			return null
		} finally {
			restoreConsole()
		}
	}

	@Spec("Extracts decorator arguments for reporting.")

	@Out("metadata", "ScenarioMetadata")
	private getScenarioMetadata(method: MethodDeclaration): ScenarioMetadata {
		const decorator = BaseRule.findDecorator(method, "Scenario")
		if (!decorator) {
			return {}
		}
		const args = decorator.getArguments()
		return {
			id: this.getArgumentString(args[0]?.getText()),
			title: this.getArgumentString(args[1]?.getText())
		}
	}

	@Spec("Converts a decorator argument text into a usable string.")

	@Out("value", "string | undefined")
	private getArgumentString(text?: string) {
		if (!text) {
			return undefined
		}
		const first = text[0]
		const last = text[text.length - 1]
		if ((first === "\"" || first === "'" || first === "`") && last === first) {
			return text.slice(1, -1)
		}
		return text
	}

	@Spec("Derives a project-relative path when possible for reporting.")

	@Out("path", "string")
	private toProjectRelativePath(filePath: string) {
		const relative = path.relative(this.projectRoot, filePath)
		if (!relative || relative.startsWith("..")) {
			return filePath
		}
		return relative
	}

	@Spec("Reports missing compiled module for a class.")

	@Out("diagnostic", "Diagnostic")
	private createModuleDiagnostic(file: string, className: string): DiagnosticObject {
		return {
			file,
			line: 0,
			message: `Use case runner could not load compiled class '${className}'. Ensure the project is built and outDir contains the compiled file.`,
			severity: "error",
			ruleCode: this.getRuleCode()
		}
	}

	@Spec("Reports when a scenario method is undefined at runtime.")

	@Out("diagnostic", "DiagnosticObject")
	private createMissingScenarioDiagnostic(context: ScenarioContext) {
		return BaseRule.createError(
			context.filePath,
			`Scenario method '${context.scenarioMethodName}' on '${context.className}' was not found at runtime.`,
			this.getRuleCode(),
			context.line
		)
	}

	@Spec("Reports missing environment declaration at runtime.")
	@Out("diagnostic", "DiagnosticObject")
	private createMissingEnvironmentDiagnostic(file: string, className: string, line: number) {
		return BaseRule.createError(
			file,
			`Use case companion '${className}' must declare environment = 'api' | 'browser'.`,
			this.getRuleCode(),
			line
		)
	}

	@Spec("Reports that browser environment is not implemented yet.")
	@Out("diagnostic", "DiagnosticObject")
	private createBrowserNotImplementedDiag(file: string, className: string, line: number) {
		const message = `Browser environment for '${className}' is not implemented yet. Switch to environment = 'api'.`
		return BaseRule.createWarning(file, message, this.getRuleCode(), line)
	}

	@Spec("Reports view forbidden in api environment.")
	@Out("diagnostic", "DiagnosticObject")
	private createViewForbiddenDiag(file: string, className: string, line: number) {
		return BaseRule.createError(
			file,
			`Companion '${className}' must not declare view() when environment is 'api'.`,
			this.getRuleCode(),
			line
		)
	}

	@Spec("Formats scenario failure details.")

	@Out("diagnostic", "Diagnostic")
	private buildDiagnostic(
		context: ScenarioContext,
		phase: Phase,
		error: unknown,
		logs: string[],
		htmlSnapshot: string
	): DiagnosticObject {
		const messageLines = [
			`Use case ${context.className}.${context.scenarioMethodName} scenario "${context.scenarioName}" failed during ${phase}.`,
			`Reason: ${this.formatError(error)}`
		]

		const cleanedHtml = htmlSnapshot?.trim()
		if (cleanedHtml) {
			messageLines.push(`DOM snapshot:\n${cleanedHtml.slice(0, 100)}...`)
		}

		if (logs.length) {
			messageLines.push(`Captured logs:\n${logs.join("\n")}`)
		}

		return {
			file: context.filePath,
			line: context.line,
			message: messageLines.join("\n\n"),
			severity: "error",
			ruleCode: this.getRuleCode()
		}
	}

	@Spec("Produces a human-readable error message.")

	@Out("message", "string")
	private formatError(error: unknown) {
		if (error instanceof Error) {
			const stack = error.stack ?? error.message ?? String(error)
			const lines = stack.split("\n").map(line => line.trimEnd())
			if (lines.length <= 3) {
				return lines.join("\n")
			}

			const [headline, ...rest] = lines
			const shortened = rest.slice(-2)
			return [headline, ...shortened].join("\n")
		}

		if (typeof error === "string") {
			return error
		}

		return util.inspect(error, { depth: 4, colors: false })
	}

	@Spec("Creates an assertion helper used inside scenarios.")

	@Out("assertFn", "(condition:boolean,message?:string)=>void")
	private createAssert() {
		return (condition: boolean, message = "Assertion failed"): asserts condition => {
			if (!condition) {
				throw new Error(message)
			}
		}
	}

	@Spec("Captures console output during scenario execution.")

	@Out("restore", "() => void")
	private hookConsole(logs: string[]) {
		const originalLog = console.log
		const originalWarn = console.warn
		const originalError = console.error

		console.log = (...args: unknown[]) => {
			logs.push(this.formatLog("log", args))
		}
		console.warn = (...args: unknown[]) => {
			logs.push(this.formatLog("warn", args))
		}
		console.error = (...args: unknown[]) => {
			logs.push(this.formatLog("error", args))
		}

		return () => {
			console.log = originalLog
			console.warn = originalWarn
			console.error = originalError
		}
	}

	@Spec("Formats console output for diagnostics.")

	@Out("entry", "string")
	private formatLog(level: "log" | "warn" | "error", args: unknown[]) {
		const rendered = args.map(arg => typeof arg === "string" ? arg : util.inspect(arg, { depth: 4, colors: false }))
		return `[${level}] ${rendered.join(" ")}`
	}

	@Spec("Returns the diagnostic rule code used by this runner.")

	@Out("ruleCode", "RuleCode")
	private getRuleCode(): RuleCode {
		return "usecase-failure"
	}
}
