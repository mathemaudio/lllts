// Runtime implementations of LLLTS decorators
// These are no-op decorators that exist purely for TypeScript compilation
// The actual decorator processing is done by the LLLTS compiler using ts-morph

export function Spec(description: string): any {
	return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
		// No-op: metadata is processed by LLLTS compiler
		if (descriptor !== undefined) {
			return descriptor
		}
		return target
	} as any
}


export function Out(description: string, type: string) {
	return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
		// No-op: metadata is processed by LLLTS compiler
	}
}

export function Scenario(description: string) {
	return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
		// No-op: metadata is processed by LLLTS compiler
	}
}
