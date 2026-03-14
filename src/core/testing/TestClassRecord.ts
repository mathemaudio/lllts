import type { ClassDeclaration, SourceFile } from "ts-morph"

export type TestClassRecord = {
	file: SourceFile
	exportedClass: ClassDeclaration
	className: string
	relativeFile: string
}
