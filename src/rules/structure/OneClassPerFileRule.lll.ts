
import { SyntaxKind } from "ts-morph"
import { BaseRule } from "../../core/BaseRule.lll"
import { FileVariantSupport } from "../../core/variants/FileVariantSupport.lll"
import { Rule } from "../../core/rulesEngine/Rule"
import { Spec } from "../../public/lll.lll"

@Spec("Ensures each file has exactly one exported primary class/type and no additional top-level class/type/interface declarations.")

export class OneClassPerFileRule {
	@Spec("Returns the rule configuration object.")
	public static getRule(): Rule {
		return {
			id: "R1",
			title: "One export per file",
			run(sourceFile) {
				return OneClassPerFileRule.runRule(sourceFile)
			}
		}
	}

	@Spec("Runs one-export-per-file validation for one source file.")
	private static runRule(sourceFile: import("ts-morph").SourceFile): import("../../core/DiagnosticObject").DiagnosticObject[] {
		const filePath = sourceFile.getFilePath()
		if (!filePath.endsWith(".ts")) {
			return []
		}
		if (OneClassPerFileRule.isPureReExportBarrel(sourceFile)) {
			return []
		}

		const exportedClasses = sourceFile.getClasses().filter(c => c.isExported())
		const exportedTypes = sourceFile.getTypeAliases().filter(t => t.isExported())
		const exportedInterfaces = sourceFile.getInterfaces().filter(i => i.isExported())
		const totalExports = exportedClasses.length + exportedTypes.length
		const exportedFunctions = OneClassPerFileRule.collectExportedFunctions(sourceFile)

		const missingExportDiagnostics = OneClassPerFileRule.buildMissingOrInvalidExportDiagnostics(sourceFile, totalExports, exportedFunctions, exportedInterfaces)
		if (missingExportDiagnostics.length > 0) {
			return missingExportDiagnostics
		}

		const exportNameDiagnostics = OneClassPerFileRule.buildExportNameMismatchDiagnostics(sourceFile, exportedClasses, exportedTypes)
		if (exportNameDiagnostics.length > 0) {
			return exportNameDiagnostics
		}

		const extraTopLevelDiagnostics = OneClassPerFileRule.buildExtraTopLevelDeclarationDiagnostics(sourceFile, exportedClasses, exportedTypes)
		if (extraTopLevelDiagnostics.length > 0) {
			return extraTopLevelDiagnostics
		}

		return OneClassPerFileRule.buildExtraExportDiagnostics(sourceFile, exportedClasses, exportedTypes, exportedFunctions)
	}

	@Spec("Collects exported function names from one source file.")
	private static collectExportedFunctions(sourceFile: import("ts-morph").SourceFile): string[] {
		const exportedFunctions: string[] = []
		sourceFile.getFunctions().forEach(func => {
			if (func.isExported()) {
				exportedFunctions.push(`function ${func.getName()}`)
			}
		})
		return exportedFunctions
	}

	@Spec("Builds diagnostics for missing or invalid primary exports.")
	private static buildMissingOrInvalidExportDiagnostics(
		sourceFile: import("ts-morph").SourceFile,
		totalExports: number,
		exportedFunctions: string[],
		exportedInterfaces: import("ts-morph").InterfaceDeclaration[]
	): import("../../core/DiagnosticObject").DiagnosticObject[] {
		if (exportedFunctions.length > 0 && totalExports === 0) {
			return [
				BaseRule.createError(
					sourceFile.getFilePath(),
					`Expected exactly one export (class or type), found 0. File exports functions: ${exportedFunctions.join(", ")}.`,
					"no-export"
				)
			]
		}
		if (totalExports === 1) {
			return []
		}
		const interfaceNote = exportedInterfaces.length === 1 ? "You export an interface, it's not allowed. Convert your interface to a type. " : ""
		return [BaseRule.createError(sourceFile.getFilePath(), `Expected exactly one export (class or type), found ${totalExports}. ${interfaceNote}`, "no-export")]
	}

	@Spec("Builds diagnostics when the exported primary name does not match the filename.")
	private static buildExportNameMismatchDiagnostics(
		sourceFile: import("ts-morph").SourceFile,
		exportedClasses: import("ts-morph").ClassDeclaration[],
		exportedTypes: import("ts-morph").TypeAliasDeclaration[]
	): import("../../core/DiagnosticObject").DiagnosticObject[] {
		const fileName = sourceFile.getBaseName().replace(".lll.ts", "").replace(".ts", "")
		const isTestFile = FileVariantSupport.isTestFilePath(sourceFile.getFilePath())
		const exportedName = exportedClasses.length === 1 ? exportedClasses[0].getName() : exportedTypes[0].getName()
		if (isTestFile || exportedName === fileName) {
			return []
		}
		const exportedKind = exportedClasses.length === 1 ? "class" : "type"
		return [BaseRule.createError(sourceFile.getFilePath(), `Exported ${exportedKind} name "${exportedName}" must match the filename "${fileName}"`, "name-mismatch")]
	}

	@Spec("Builds diagnostics for extra top-level class, type, or interface declarations.")
	private static buildExtraTopLevelDeclarationDiagnostics(
		sourceFile: import("ts-morph").SourceFile,
		exportedClasses: import("ts-morph").ClassDeclaration[],
		exportedTypes: import("ts-morph").TypeAliasDeclaration[]
	): import("../../core/DiagnosticObject").DiagnosticObject[] {
		const primaryClass = exportedClasses.length === 1 ? exportedClasses[0] : undefined
		const primaryType = exportedTypes.length === 1 ? exportedTypes[0] : undefined
		const extraTopLevelDeclarations: string[] = []
		sourceFile.getClasses().forEach(classDecl => {
			if (classDecl !== primaryClass) {
				extraTopLevelDeclarations.push(`class ${classDecl.getName() ?? "(anonymous)"}`)
			}
		})
		sourceFile.getTypeAliases().forEach(typeAlias => {
			if (typeAlias !== primaryType) {
				extraTopLevelDeclarations.push(`type ${typeAlias.getName() ?? "(anonymous)"}`)
			}
		})
		sourceFile.getInterfaces().forEach(iface => {
			extraTopLevelDeclarations.push(`interface ${iface.getName() ?? "(anonymous)"}`)
		})
		if (extraTopLevelDeclarations.length === 0) {
			return []
		}
		const exportType = exportedClasses.length === 1 ? "class" : "type"
		const exportName = exportedClasses.length === 1 ? exportedClasses[0].getName() : exportedTypes[0].getName()
		return [
			BaseRule.createError(
				sourceFile.getFilePath(),
				`File must contain exactly one top-level ${exportType} declaration (${exportName}). Move these declarations to their own files: ${extraTopLevelDeclarations.join(", ")}.`,
				"extra-top-level"
			)
		]
	}

	@Spec("Builds diagnostics for extra exported declarations beyond the primary class or type.")
	private static buildExtraExportDiagnostics(
		sourceFile: import("ts-morph").SourceFile,
		exportedClasses: import("ts-morph").ClassDeclaration[],
		exportedTypes: import("ts-morph").TypeAliasDeclaration[],
		exportedFunctions: string[]
	): import("../../core/DiagnosticObject").DiagnosticObject[] {
		const allOtherExports: string[] = []
		sourceFile.getVariableStatements().forEach(varStmt => {
			if (varStmt.isExported()) {
				varStmt.getDeclarations().forEach(decl => {
					allOtherExports.push(`const ${decl.getName()}`)
				})
			}
		})
		exportedFunctions.forEach(funcName => {
			allOtherExports.push(funcName)
		})
		sourceFile.getInterfaces().forEach(iface => {
			if (iface.isExported()) {
				allOtherExports.push(`interface ${iface.getName()}`)
			}
		})
		sourceFile.getEnums().forEach(enumDecl => {
			if (enumDecl.isExported()) {
				allOtherExports.push(`enum ${enumDecl.getName()}`)
			}
		})
		if (allOtherExports.length === 0) {
			return []
		}
		const exportType = exportedClasses.length === 1 ? "class" : "type"
		const exportName = exportedClasses.length === 1 ? exportedClasses[0].getName() : exportedTypes[0].getName()
		return [
			BaseRule.createError(
				sourceFile.getFilePath(),
				`File should export only lll ${exportType} (${exportName}), but also exports: ${allOtherExports.join(", ")}.`,
				"extra-exports"
			)
		]
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
}
