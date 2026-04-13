export class OverlayModuleRuntime {
	private static readonly nativeHTMLElementConstructor = typeof HTMLElement === "function" ? HTMLElement : null

	public static detectPageModuleTParam(): string {
		const moduleScripts = document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')
		for (const script of moduleScripts) {
			const src = script.getAttribute("src")
			if (!src) {
				continue
			}
			try {
				const srcUrl = new URL(src, window.location.href)
				const tValue = srcUrl.searchParams.get("t")
				if (tValue) {
					return tValue
				}
			} catch {
			}
		}
		return ""
	}

	public static installIdempotentCustomElementDefineGuard(): void {
		if (typeof window === "undefined" || !window.customElements || typeof window.customElements.define !== "function") {
			return
		}
		const registry = window.customElements as CustomElementRegistry & {
			__llltsDuplicateDefineGuardInstalled?: boolean
		}
		if (registry.__llltsDuplicateDefineGuardInstalled === true) {
			return
		}
		const originalDefine = registry.define.bind(registry)
		registry.define = function (name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions): void {
			const normalizedName = String(name ?? "")
			const existingConstructor = typeof registry.get === "function" ? registry.get(normalizedName) : undefined
			if (existingConstructor) {
				const existingName = String(existingConstructor.name ?? "")
				const incomingName = constructor && typeof constructor === "function" ? String(constructor.name ?? "") : ""
				if (existingConstructor === constructor || (existingName.length > 0 && existingName === incomingName)) {
					return
				}
			}
			originalDefine(name, constructor, options)
		}
		registry.__llltsDuplicateDefineGuardInstalled = true
	}

	public static buildImportUrl(testPath: unknown, tParam: unknown): string {
		const normalizedPath = String(testPath ?? "").replace(/^\/+/, "")
		const basePath = `/${normalizedPath}`
		if (!tParam) {
			return basePath
		}
		const separator = basePath.includes("?") ? "&" : "?"
		return `${basePath}${separator}t=${encodeURIComponent(String(tParam))}`
	}

	public static buildPairedHostImportUrl(testModuleUrl: unknown, testPath: unknown): string {
		const hostClassName = this.resolveHostClassNameFromTestPath(testPath)
		const absoluteTestModuleUrl = new URL(String(testModuleUrl ?? ""), document.baseURI).toString()
		if (!hostClassName) {
			return new URL(this.buildImportUrl(this.resolveHostPathFromTestPath(testPath), ""), document.baseURI).toString()
		}
		return new URL(`./${hostClassName}.lll.ts`, absoluteTestModuleUrl).toString()
	}

	public static resolveTestClass(moduleObject: Record<string, unknown> | null): ((...args: unknown[]) => unknown) | null {
		if (!moduleObject || typeof moduleObject !== "object") {
			return null
		}
		const exportKeys = Object.keys(moduleObject)
		for (const exportKey of exportKeys) {
			const candidate = moduleObject[exportKey]
			if (!this.isFunction(candidate)) {
				continue
			}
			const candidateName = String((candidate as { name?: unknown }).name ?? "")
			if (candidateName.endsWith("Test")) {
				return candidate as (...args: unknown[]) => unknown
			}
		}
		const defaultExport = moduleObject.default
		if (this.isFunction(defaultExport)) {
			return defaultExport as (...args: unknown[]) => unknown
		}
		return null
	}

	public static resolveHostPathFromTestPath(testPath: unknown): string {
		return String(testPath ?? "").replace(/\.test2?\.lll\.ts$/, ".lll.ts")
	}

	public static resolveHostClassNameFromTestPath(testPath: unknown): string {
		const rawPath = String(testPath ?? "")
		const fileName = rawPath.split("/").pop() ?? rawPath
		const match = /^(.*)\.test2?\.lll\.ts$/.exec(fileName)
		return match ? match[1] : ""
	}

	public static resolveHostClass(moduleObject: Record<string, unknown> | null, testPath: unknown): ((...args: unknown[]) => unknown) | null {
		if (!moduleObject || typeof moduleObject !== "object") {
			return null
		}
		const expectedName = this.resolveHostClassNameFromTestPath(testPath)
		if (expectedName && this.isFunction(moduleObject[expectedName])) {
			return moduleObject[expectedName] as (...args: unknown[]) => unknown
		}
		const defaultExport = moduleObject.default
		if (this.isFunction(defaultExport)) {
			return defaultExport as (...args: unknown[]) => unknown
		}
		return null
	}

	public static isHTMLElementSubclass(TestClass: unknown): boolean {
		const nativeHTMLElement = this.nativeHTMLElementConstructor
		return nativeHTMLElement !== null
			&& !!TestClass
			&& typeof TestClass === "function"
			&& !!TestClass.prototype
			&& TestClass.prototype instanceof nativeHTMLElement
	}

	public static isNativeHTMLElementInstance(value: unknown): value is HTMLElement {
		const nativeHTMLElement = this.nativeHTMLElementConstructor
		return nativeHTMLElement !== null && value instanceof nativeHTMLElement
	}

	public static async settleRenderedSubject(subject: unknown): Promise<void> {
		const typedSubject = subject as { updateComplete?: Promise<unknown> }
		if (typedSubject && typeof typedSubject.updateComplete === "object" && typeof typedSubject.updateComplete?.then === "function") {
			await typedSubject.updateComplete
		}
	}

	public static clearRenderHost(popupRenderHost: HTMLElement): void {
		while (popupRenderHost.firstChild) {
			popupRenderHost.removeChild(popupRenderHost.firstChild)
		}
	}

	public static async mountBehavioralSubject(
		popupRenderHost: HTMLElement,
		HostClass: new () => unknown
	): Promise<{ subject: unknown, element: HTMLElement | null }> {
		this.clearRenderHost(popupRenderHost)
		const subject = new HostClass()
		let element: HTMLElement | null = null
		if (this.isHTMLElementSubclass(HostClass) && this.isNativeHTMLElementInstance(subject)) {
			element = subject
			popupRenderHost.appendChild(element)
		}
		await this.settleRenderedSubject(subject)
		return {
			subject,
			element
		}
	}

	private static isFunction(value: unknown): value is (...args: unknown[]) => unknown {
		return typeof value === "function"
	}
}
