declare class AmbientThing {
	static readonly brand: string
}

namespace InternalNamespace {
	export const value = "x"
}

export class BadTopLevelNamespaceOrDeclare {
	public static read() {
		return InternalNamespace.value
	}
}
