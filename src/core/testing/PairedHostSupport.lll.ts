import type { ClassDeclaration, SourceFile } from "ts-morph"
import { Node } from "ts-morph"
import { BaseRule } from "../BaseRule.lll"
import { FileVariantSupport } from "../FileVariantSupport.lll"
import { Spec } from "../../public/lll.lll"

export type PairedHostKind = "instantiable" | "static-only"

@Spec("Provides deterministic paired-host lookup and classification for companion test files.")
export class PairedHostSupport {
	@Spec("Resolves the paired production file path represented by a companion test file.")
	public static getHostFilePath(testFilePath: string): string | null {
		return FileVariantSupport.getPrimaryFilePath(testFilePath)
	}

	@Spec("Resolves the paired production class name represented by a companion test file.")
	public static getHostClassName(testFilePath: string): string | null {
		return FileVariantSupport.getHostClassNameFromTestPath(testFilePath)
	}

	@Spec("Looks up the paired production class declaration from the same ts-morph project.")
	public static getHostClass(testSourceFile: SourceFile): ClassDeclaration | undefined {
		const hostFilePath = this.getHostFilePath(testSourceFile.getFilePath())
		if (hostFilePath === null) {
			return undefined
		}
		const hostSourceFile = testSourceFile.getProject().getSourceFile(hostFilePath)
		if (hostSourceFile === undefined) {
			return undefined
		}
		return BaseRule.getExportedClass(hostSourceFile)
	}

	@Spec("Classifies the paired host deterministically: static-only means no constructors and no instance members.")
	public static getHostKind(testSourceFile: SourceFile): PairedHostKind {
		const hostClass = this.getHostClass(testSourceFile)
		if (hostClass === undefined) {
			return "instantiable"
		}
		return this.isStaticOnlyHostClass(hostClass) ? "static-only" : "instantiable"
	}

	@Spec("Returns whether a class is static-only under the companion scenario contract.")
	public static isStaticOnlyHostClass(hostClass: ClassDeclaration): boolean {
		return !hostClass.getMembers().some(member => {
			if (Node.isConstructorDeclaration(member)) {
				return true
			}
			if (
				Node.isMethodDeclaration(member) ||
				Node.isPropertyDeclaration(member) ||
				Node.isGetAccessorDeclaration(member) ||
				Node.isSetAccessorDeclaration(member)
			) {
				return !member.isStatic()
			}
			return false
		})
	}
}
