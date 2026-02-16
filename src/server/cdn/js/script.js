(function () {
	var CONFIG_ELEMENT_ID = "lllts-overlay-config";
	var FALLBACK_ASSETS_BASE_PATH = "/__lllts-overlay";

	function parseConfig() {
		var configElement = document.getElementById(CONFIG_ELEMENT_ID);
		if (!configElement) {
			return {};
		}
		try {
			return JSON.parse(configElement.textContent || "{}");
		} catch (_error) {
			return {};
		}
	}

	function getAssetsBasePath(config) {
		if (!config || typeof config.assetsBasePath !== "string") {
			return FALLBACK_ASSETS_BASE_PATH;
		}
		var trimmed = config.assetsBasePath.trim();
		return trimmed.length > 0 ? trimmed : FALLBACK_ASSETS_BASE_PATH;
	}

	function getScenarioApi() {
		if (typeof window !== "undefined" && window.llltsOverlayScenarios) {
			return window.llltsOverlayScenarios;
		}
		return {
			getScenariosForTest: function () {
				return [];
			},
			renderScenarioButtons: function (listElement, emptyElement) {
				if (!listElement || !emptyElement) {
					return;
				}
				listElement.textContent = "";
				emptyElement.hidden = false;
			},
				markScenarioSelection: function () {
				},
				setScenarioState: function () {
				},
				runScenarioMethod: async function () {
					throw new Error("Scenario helper script is unavailable.");
				}
		};
	}

	async function loadOverlayTemplate(assetsBasePath) {
		var templateResponse = await fetch(assetsBasePath + "/index.html", { credentials: "same-origin" });
		if (!templateResponse.ok) {
			throw new Error("Overlay template request failed with status " + String(templateResponse.status) + ".");
		}
		return await templateResponse.text();
	}

	function ensureOverlayMarkup(templateHtml) {
		if (document.getElementById("lllts-test-toggle")) {
			return;
		}
		var container = document.createElement("div");
		container.innerHTML = String(templateHtml || "");
		while (container.firstChild) {
			document.body.appendChild(container.firstChild);
		}
	}

	function clearRenderHost(popupRenderHost) {
		while (popupRenderHost.firstChild) {
			popupRenderHost.removeChild(popupRenderHost.firstChild);
		}
	}

	function setStatus(popupStatus, message, isError) {
		popupStatus.textContent = message || "";
		if (isError) {
			popupStatus.setAttribute("data-state", "error");
			return;
		}
		popupStatus.removeAttribute("data-state");
	}

	function errorMessage(error) {
		if (error && typeof error === "object" && "message" in error) {
			var message = String(error.message || "");
			if (message.length > 0) {
				return message;
			}
		}
		return String(error || "Unknown error");
	}

	function detectPageModuleTParam() {
		var moduleScripts = document.querySelectorAll('script[type="module"][src]');
		for (var i = 0; i < moduleScripts.length; i += 1) {
			var script = moduleScripts[i];
			var src = script.getAttribute("src");
			if (!src) {
				continue;
			}
			try {
				var srcUrl = new URL(src, window.location.href);
				var tValue = srcUrl.searchParams.get("t");
				if (tValue) {
					return tValue;
				}
			} catch (_error) { }
		}
		return "";
	}

	function buildImportUrl(testPath, tParam) {
		var normalizedPath = String(testPath || "").replace(/^\/+/, "");
		var basePath = "/" + normalizedPath;
		if (!tParam) {
			return basePath;
		}
		var separator = basePath.indexOf("?") === -1 ? "?" : "&";
		return basePath + separator + "t=" + encodeURIComponent(tParam);
	}

	function isFunction(value) {
		return typeof value === "function";
	}

	function resolveTestClass(moduleObject) {
		if (!moduleObject || typeof moduleObject !== "object") {
			return null;
		}
		var exportKeys = Object.keys(moduleObject);
		for (var i = 0; i < exportKeys.length; i += 1) {
			var candidate = moduleObject[exportKeys[i]];
			if (!isFunction(candidate)) {
				continue;
			}
			var candidateName = String(candidate.name || "");
			if (candidateName.endsWith("Test")) {
				return candidate;
			}
		}
		var defaultExport = moduleObject.default;
		if (isFunction(defaultExport)) {
			return defaultExport;
		}
		return null;
	}

	function hashPath(value) {
		var hash = 2166136261 >>> 0;
		for (var i = 0; i < value.length; i += 1) {
			hash ^= value.charCodeAt(i);
			hash = Math.imul(hash, 16777619);
		}
		return (hash >>> 0).toString(16);
	}

	function buildPreviewTagName(testPath) {
		var rawPath = String(testPath || "");
		var slug = rawPath.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
		if (!slug) {
			slug = "test";
		}
		return "lllts-preview-" + slug + "-" + hashPath(rawPath);
	}

	function isHTMLElementSubclass(TestClass) {
		return typeof HTMLElement !== "undefined" && !!TestClass && !!TestClass.prototype && TestClass.prototype instanceof HTMLElement;
	}

	function createPreviewElementClass(TestClass) {
		return class extends TestClass { };
	}

	function ensurePreviewTagDefined(tagName, TestClass) {
		var existingDefinition = customElements.get(tagName);
		if (existingDefinition) {
			return tagName;
		}
		var PreviewElementClass = createPreviewElementClass(TestClass);
		customElements.define(tagName, PreviewElementClass);
		return tagName;
	}

	function resolveUsableTagName(TestClass, testPath) {
		var preferredTag = buildPreviewTagName(testPath);
		return ensurePreviewTagDefined(preferredTag, TestClass);
	}

	function mountBehavioralPreview(popupRenderHost, TestClass, testPath) {
		var tagName = resolveUsableTagName(TestClass, testPath);
		var element = document.createElement(tagName);
		popupRenderHost.appendChild(element);
		return {
			tagName: tagName,
			element: element
		};
	}

	function wireOverlay(config) {
		var tests = Array.isArray(config.tests) ? config.tests : [];
		var openByDefault = !!config.openByDefault;
		var scenarioApi = getScenarioApi();
		var loadTokenCounter = 0;
		var toggleButton = document.getElementById("lllts-test-toggle");
		var panel = document.getElementById("lllts-test-panel");
		var list = document.getElementById("lllts-test-list");
		var emptyState = document.getElementById("lllts-test-empty");
		var popup = document.getElementById("lllts-test-popup");
		var popupBody = document.getElementById("lllts-test-popup-body");
		var popupLink = document.getElementById("lllts-test-popup-link");
		var popupStatus = document.getElementById("lllts-test-popup-status");
		var popupRenderHost = document.getElementById("lllts-test-popup-render");
		var popupClose = document.getElementById("lllts-test-popup-close");
		var popupScenariosList = document.getElementById("lllts-test-popup-scenarios-list");
		var popupScenariosEmpty = document.getElementById("lllts-test-popup-scenarios-empty");

		if (
			!toggleButton ||
			!panel ||
			!list ||
			!emptyState ||
			!popup ||
			!popupBody ||
			!popupLink ||
			!popupStatus ||
			!popupRenderHost ||
			!popupClose ||
			!popupScenariosList ||
			!popupScenariosEmpty
		) {
			return;
		}
		if (toggleButton.getAttribute("data-lllts-wired") === "true") {
			return;
		}
		toggleButton.setAttribute("data-lllts-wired", "true");

		function openPopup() {
			popup.classList.add("lllts-open");
		}

		function closePopup() {
			popup.classList.remove("lllts-open");
		}

		if (openByDefault) {
			panel.classList.add("lllts-open");
		}
		toggleButton.addEventListener("click", function () {
			panel.classList.toggle("lllts-open");
		});
		popupClose.addEventListener("click", closePopup);

		if (tests.length === 0) {
			emptyState.hidden = false;
			return;
		}
		emptyState.hidden = true;
		list.textContent = "";

		tests.forEach(function (testPath) {
			var item = document.createElement("li");
			var button = document.createElement("button");
			button.type = "button";
			button.textContent = String(testPath);
			button.addEventListener("click", async function () {
				var selectedPath = String(testPath || "");
				var selectedScenarios = scenarioApi.getScenariosForTest(config, selectedPath);
				loadTokenCounter += 1;
				var loadToken = loadTokenCounter;
				var activeTestClass = null;
				var activePreviewElement = null;

				scenarioApi.renderScenarioButtons(popupScenariosList, popupScenariosEmpty, selectedScenarios, async function (scenario) {
					if (loadToken !== loadTokenCounter) {
						return;
					}
					if (!activeTestClass) {
						setStatus(popupStatus, "Test is still loading. Please wait.", false);
						return;
						}
						scenarioApi.markScenarioSelection(popupScenariosList, scenario.methodName);
						scenarioApi.setScenarioState(popupScenariosList, scenario.methodName, "idle");
						setStatus(popupStatus, "Running scenario: " + scenario.title, false);
						try {
							await scenarioApi.runScenarioMethod(activeTestClass, scenario.methodName, {
							testPath: selectedPath,
							previewElement: activePreviewElement,
							renderHost: popupRenderHost,
							document: document,
								window: window
							});
							scenarioApi.setScenarioState(popupScenariosList, scenario.methodName, "success");
							setStatus(popupStatus, "Scenario passed: " + scenario.title, false);
						} catch (scenarioError) {
							scenarioApi.setScenarioState(popupScenariosList, scenario.methodName, "error");
							setStatus(popupStatus, errorMessage(scenarioError), true);
						}
					});
				scenarioApi.markScenarioSelection(popupScenariosList, "");

				openPopup();
				popupBody.textContent = "Loading test preview...";
				popupLink.textContent = selectedPath;
				setStatus(popupStatus, "", false);
				clearRenderHost(popupRenderHost);
				try {
					var detectedT = detectPageModuleTParam();
					var moduleUrl = buildImportUrl(selectedPath, detectedT);
					setStatus(popupStatus, "Importing " + moduleUrl, false);
					var moduleObject = await import(moduleUrl);
					if (loadToken !== loadTokenCounter) {
						return;
					}
					var TestClass = resolveTestClass(moduleObject);
					if (!TestClass) {
						throw new Error("No exported '*Test' class (or default class/function) was found.");
					}
					activeTestClass = TestClass;
					var testInstance;
					try {
						testInstance = new TestClass();
					} catch (instantiateError) {
						if (!isHTMLElementSubclass(TestClass)) {
							throw instantiateError;
						}
						var fallbackTagName = resolveUsableTagName(TestClass, selectedPath);
						testInstance = document.createElement(fallbackTagName);
					}
					var testType = testInstance ? testInstance.testType : undefined;
					if (testType === "unit") {
						popupBody.textContent = "Please choose a scenario to run this unit test.";
						if (selectedScenarios.length > 0) {
							setStatus(popupStatus, "Choose a scenario from the left panel.", false);
						} else {
							setStatus(popupStatus, "No scenarios were discovered for this unit test.", false);
						}
						return;
					}
					if (testType === "behavioral") {
						popupBody.textContent = "Please choose a scenario or play with this behavioral test component yourself.";
						var preview = mountBehavioralPreview(popupRenderHost, TestClass, selectedPath);
						activePreviewElement = preview.element;
						if (selectedScenarios.length > 0) {
							setStatus(popupStatus, "Choose a scenario from the left panel.", false);
						} else {
							setStatus(popupStatus, "Behavioral preview is ready. No scenarios were discovered.", false);
						}
						return;
					}
					throw new Error("Unsupported testType '" + String(testType) + "'. Expected 'unit' or 'behavioral'.");
				} catch (error) {
					if (loadToken !== loadTokenCounter) {
						return;
					}
					popupBody.textContent = "Unable to preview this test.";
					setStatus(popupStatus, errorMessage(error), true);
				}
			});
			item.appendChild(button);
			list.appendChild(item);
		});
	}

	async function init() {
		var config = parseConfig();
		var assetsBasePath = getAssetsBasePath(config);
		var templateHtml = await loadOverlayTemplate(assetsBasePath);
		ensureOverlayMarkup(templateHtml);
		wireOverlay(config);
	}

	init().catch(function (error) {
		console.error("[LLLTS overlay] Failed to initialize overlay.", error);
	});
})();
