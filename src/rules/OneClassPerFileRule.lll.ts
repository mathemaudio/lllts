
import { Rule } from "../core/Rule"
import { BaseRule } from "../core/BaseRule.lll"
import { Out } from "../public/lll.lll"
import { Spec } from "../public/lll.lll"
import { SyntaxKind } from "ts-morph"

@Spec("Ensures each .lll.ts file exports exactly lll item, which can be either a class or a type alias.")

export class OneClassPerFileRule {
	@Spec("Returns the rule configuration object.")

	@Out("rule", "Rule")
	public static getRule(): Rule {
		const old_tsNote = ``
		return {
			id: "R1",
			title: "One export per file",
			run(sourceFile) {
				// Skip non-TypeScript files (e.g., CSS, JSON, etc.)
				const filePath = sourceFile.getFilePath()
				const validExtensions = ['.ts',]
				if (!validExtensions.some(ext => filePath.endsWith(ext))) {
					return []
				}

				if (OneClassPerFileRule.isPureReExportBarrel(sourceFile)) {
					return []
				}

				const exportedClasses = sourceFile.getClasses().filter(c => c.isExported())
				const exportedTypes = sourceFile.getTypeAliases().filter(t => t.isExported())
				const exportedInterfaces = sourceFile.getInterfaces().filter(i => i.isExported())
				// Count total exported items (classes + type aliases)
				const totalExports = exportedClasses.length + exportedTypes.length

				// Check for exported functions first (to provide helpful .old.ts suggestion)
				const exportedFunctions: string[] = []
				sourceFile.getFunctions().forEach(func => {
					if (func.isExported()) {
						exportedFunctions.push(`function ${func.getName()}`)
					}
				})


				if (exportedFunctions.length > 0 && totalExports === 0) {
					const functionsList = exportedFunctions.join(", ")
					return [
						BaseRule.createError(
							sourceFile.getFilePath(),
							`Expected exactly one export (class or type), found 0. File exports functions: ${functionsList}. ${old_tsNote}`,
							"no-export"
						)
					]
				}

				// Check if there's exactly lll export total
				if (totalExports !== 1) {
					return [
						BaseRule.createError(
							sourceFile.getFilePath(),
							`Expected exactly one export (class or type), found ${totalExports}. ${exportedInterfaces.length === 1 ? "You export an interface, it's not allowed. Convert your interface to a type. " : old_tsNote
							}`,
							"no-export"
						)
					]
				}

				// Check if the exported class or type name matches the filename
				const fileName = sourceFile.getBaseName().replace('.lll.ts', '').replace('.ts', '')
				const isTestFile = sourceFile.getBaseName().endsWith(".test.lll.ts")
				const exportedName = exportedClasses.length === 1
					? exportedClasses[0].getName()
					: exportedTypes[0].getName()

				if (!isTestFile && exportedName !== fileName) {
					return [
						BaseRule.createError(
							sourceFile.getFilePath(),
							`Exported ${exportedClasses.length === 1 ? 'class' : 'type'} name "${exportedName}" must match the filename "${fileName}"`,
							"name-mismatch"
						)
					]
				}

				// Check for any other exports (variables, functions, interfaces, enums)
				const allOtherExports: string[] = []

				// Get exported variables/constants
				sourceFile.getVariableStatements().forEach(varStmt => {
					if (varStmt.isExported()) {
						varStmt.getDeclarations().forEach(decl => {
							allOtherExports.push(`const ${decl.getName()}`)
						})
					}
				})

				// Get exported functions (already collected above, but add to allOtherExports)
				exportedFunctions.forEach(funcName => {
					allOtherExports.push(funcName)
				})

				// Get exported interfaces
				sourceFile.getInterfaces().forEach(iface => {
					if (iface.isExported()) {
						allOtherExports.push(`interface ${iface.getName()}`)
					}
				})

				// Get exported enums
				sourceFile.getEnums().forEach(enumDecl => {
					if (enumDecl.isExported()) {
						allOtherExports.push(`enum ${enumDecl.getName()}`)
					}
				})

				// Note: We already accounted for type aliases above, so we don't check them here

				if (allOtherExports.length > 0) {
					const exportType = exportedClasses.length === 1 ? 'class' : 'type'
					const exportName = exportedClasses.length === 1 ? exportedClasses[0].getName() : exportedTypes[0].getName()
					const exportsList = allOtherExports.join(", ")

					const functionNote = exportedFunctions.length > 0 ? old_tsNote : ""
					return [
						BaseRule.createError(
							sourceFile.getFilePath(),
							`File should export only lll ${exportType} (${exportName}), but also exports: ${exportsList}.${functionNote}`,
							"extra-exports"
						)
					]
				}

				return []
			}
		}
	}

	@Spec("Detects files that only re-export from other modules (barrel files).")
	@Out("barrelOnly", "boolean")
	private static isPureReExportBarrel(sourceFile: import("ts-morph").SourceFile) {
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
