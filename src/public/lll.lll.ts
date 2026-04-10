
export type AssertFn = (condition: boolean, message?: string) => asserts condition;
export type WaitForFn = (
	predicate: () => boolean | Promise<boolean>,
	message: string,
	timeoutMs?: number,
	intervalMs?: number
) => Promise<void>;

export function Spec(description: string): any {
	return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
		// No-op: metadata is processed by LLLTS compiler
		if (descriptor !== undefined) {
			return descriptor
		}
		return target
	} as any
}
export function Scenario(description: string) {
	return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
		// No-op: metadata is processed by LLLTS compiler
	};
}
