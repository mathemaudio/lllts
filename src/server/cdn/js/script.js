(function () {
	var CONFIG_ELEMENT_ID = "lllts-overlay-config";
	var FALLBACK_ASSETS_BASE_PATH = "/__lllts-overlay";
	var TEST_STATUS_EMOJI_PASSED = "🟢";
	var TEST_STATUS_EMOJI_FAILED = "⛔️";
	var FIXED_LAST_RUN_REPORT_KEY = "FIXED_llltsLastRunReport";
	var FIXED_LAST_RUN_REPORT_JSON_KEY = "FIXED_llltsLastRunReportJson";
	var FIXED_RUN_PROGRESS_JSON_KEY = "FIXED_llltsRunProgressJson";

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

	function shouldAutoRunFromQuery() {
		try {
			var currentUrl = new URL(window.location.href);
			return currentUrl.searchParams.get("automatic") === "true";
		} catch (_error) {
			return false;
		}
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
			markScenarioSelection: function () { },
			setScenarioState: function () { },
			setAllScenarioStates: function () { },
			setPlayAllState: function () { },
			setPlayAllEnabled: function () { },
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
		if (document.getElementById("lllts-test-panel")) {
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
		for (var i = 0; i < moduleScripts.length; i++) {
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
		for (var i = 0; i < exportKeys.length; i++) {
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
		for (var i = 0; i < value.length; i++) {
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
		var backdrop = document.getElementById("lllts-overlay-backdrop");
		var panel = document.getElementById("lllts-test-panel");
		var list = document.getElementById("lllts-test-list");
		var emptyState = document.getElementById("lllts-test-empty");
		var panelPlayAll = document.getElementById("lllts-test-panel-play-all");
		var panelResult = document.getElementById("lllts-test-panel-result");
		var popup = document.getElementById("lllts-test-popup");
		var popupBody = document.getElementById("lllts-test-popup-body");
		var popupLink = document.getElementById("lllts-test-popup-link");
		var popupStatus = document.getElementById("lllts-test-popup-status");
		var popupRenderHost = document.getElementById("lllts-test-popup-render");
		var popupClose = document.getElementById("lllts-test-popup-close");
		var popupScenariosList = document.getElementById("lllts-test-popup-scenarios-list");
		var popupScenariosEmpty = document.getElementById("lllts-test-popup-scenarios-empty");
		var popupScenariosPlayAll = document.getElementById("lllts-test-popup-scenarios-play-all");
		var terminalPopup = document.getElementById("lllts-terminal-popup");
		var terminalPopupBody = document.getElementById("lllts-terminal-popup-body");
		var terminalPopupClose = document.getElementById("lllts-terminal-popup-close");

		if (
			!backdrop ||
			!panel ||
			!list ||
			!emptyState ||
			!panelPlayAll ||
			!panelResult ||
			!popup ||
			!popupBody ||
			!popupLink ||
			!popupStatus ||
			!popupRenderHost ||
			!popupClose ||
			!popupScenariosList ||
			!popupScenariosEmpty ||
			!popupScenariosPlayAll ||
			!terminalPopup ||
			!terminalPopupBody ||
			!terminalPopupClose
		) {
			return;
		}
		if (panel.getAttribute("data-lllts-wired") === "true") {
			return;
		}
		panel.setAttribute("data-lllts-wired", "true");
		var isRunningAllTests = false;

		function clearFixedLastRunReport() {
			window[FIXED_LAST_RUN_REPORT_KEY] = undefined;
			window[FIXED_LAST_RUN_REPORT_JSON_KEY] = undefined;
		}

		function setFixedLastRunReport(reportText, reportJson) {
			window[FIXED_LAST_RUN_REPORT_KEY] = String(reportText || "");
			window[FIXED_LAST_RUN_REPORT_JSON_KEY] = reportJson === undefined ? undefined : reportJson;
		}

		function clearFixedRunProgress() {
			window[FIXED_RUN_PROGRESS_JSON_KEY] = undefined;
		}

		function setFixedRunProgress(progress) {
			window[FIXED_RUN_PROGRESS_JSON_KEY] = progress && typeof progress === "object" ? progress : undefined;
		}

		function openPopup() {
			closeTerminalPopup();
			popup.classList.add("lllts-open");
			syncBackdropState();
		}

		function closePopup() {
			popup.classList.remove("lllts-open");
			syncBackdropState();
		}

		function openTerminalPopup(reportText) {
			closePopup();
			terminalPopupBody.textContent = String(reportText || "");
			terminalPopup.classList.add("lllts-open");
			syncBackdropState();
		}

		function closeTerminalPopup() {
			terminalPopup.classList.remove("lllts-open");
			syncBackdropState();
		}

		function syncBackdropState() {
			backdrop.classList.add("lllts-open");
		}

		function setPanelResult(state, message) {
			panelResult.textContent = String(message || "");
			if (!state) {
				panelResult.removeAttribute("data-state");
				return;
			}
			panelResult.setAttribute("data-state", String(state));
		}

		function setPanelPlayAllEnabled(isEnabled) {
			panelPlayAll.disabled = !isEnabled;
		}

		function setListButtonsEnabled(isEnabled) {
			var listButtons = list.querySelectorAll("button[data-test-path]");
			for (var i = 0; i < listButtons.length; i++) {
				listButtons[i].disabled = !isEnabled;
			}
		}

		function setScenarioButtonsEnabled(isEnabled) {
			var scenarioButtons = popupScenariosList.querySelectorAll("button[data-scenario-method]");
			for (var i = 0; i < scenarioButtons.length; i++) {
				scenarioButtons[i].disabled = !isEnabled;
			}
		}

		function storeScenarioResult(runContext, scenario, state, details) {
			if (!runContext || !scenario) {
				return;
			}
			var methodName = String(scenario.methodName || "");
			if (methodName.length === 0) {
				return;
			}
			if (!runContext.scenarioResultByMethod) {
				runContext.scenarioResultByMethod = {};
			}
			runContext.scenarioResultByMethod[methodName] = {
				title: String(scenario.title || methodName),
				state: String(state || "failed"),
				details: String(details || "")
			};
		}

		function collectScenarioResults(runContext) {
			var results = [];
			var scenarios = runContext && Array.isArray(runContext.selectedScenarios) ? runContext.selectedScenarios : [];
			var resultMap = runContext && runContext.scenarioResultByMethod ? runContext.scenarioResultByMethod : {};
			for (var i = 0; i < scenarios.length; i++) {
				var scenario = scenarios[i];
				var methodName = String(scenario.methodName || "");
				var resolvedResult = resultMap[methodName];
				if (resolvedResult) {
					results.push({
						title: resolvedResult.title,
						state: resolvedResult.state,
						details: String(resolvedResult.details || "")
					});
					continue;
				}
				results.push({
					title: String(scenario.title || methodName || "scenario"),
					state: "failed",
					details: ""
				});
			}
			return results;
		}

		function buildTerminalReport(testReports, allPassed) {
			var lines = [];
			var reports = Array.isArray(testReports) ? testReports : [];
			for (var i = 0; i < reports.length; i++) {
				var report = reports[i];
				var testPath = String((report && report.testPath) || "unknown-test");
				var testStatus = String((report && report.status) || "failed");
				var scenarioResults = report && Array.isArray(report.scenarioResults) ? report.scenarioResults : [];
				var failedScenarioLines = [];
				for (var j = 0; j < scenarioResults.length; j++) {
					var scenarioResult = scenarioResults[j];
					var scenarioTitle = String((scenarioResult && scenarioResult.title) || "scenario");
					var scenarioState = String((scenarioResult && scenarioResult.state) || "failed");
					var scenarioDetails = String((scenarioResult && scenarioResult.details) || "").trim();
					if (scenarioState === "passed") {
						continue;
					}
					if (scenarioState === "failed" && scenarioDetails.length > 0) {
						failedScenarioLines.push(TEST_STATUS_EMOJI_FAILED + " " + scenarioTitle + ": failed: " + scenarioDetails);
						continue;
					}
					failedScenarioLines.push(TEST_STATUS_EMOJI_FAILED + " " + scenarioTitle + ": " + scenarioState);
				}
				if (failedScenarioLines.length === 0 && (testStatus === "passed" || testStatus === "no-scenarios")) {
					continue;
				}
				lines.push("## " + testPath);
				if (failedScenarioLines.length === 0) {
					lines.push(TEST_STATUS_EMOJI_FAILED + " Test failed before any scenario results were recorded");
				} else {
					for (var k = 0; k < failedScenarioLines.length; k++) {
						lines.push(failedScenarioLines[k]);
					}
				}
				lines.push("");
			}
			lines.push("");
			lines.push(allPassed ? "All client behavioral tests passed" : "some failed");
			return lines.join("\n");
		}

		function buildTerminalReportJson(testReports, allPassed) {
			var reports = Array.isArray(testReports) ? testReports : [];
			var passedScenarios = 0;
			var failedScenarios = 0;
			for (var i = 0; i < reports.length; i++) {
				var scenarioResults = Array.isArray(reports[i] && reports[i].scenarioResults) ? reports[i].scenarioResults : [];
				for (var j = 0; j < scenarioResults.length; j++) {
					var scenarioState = String((scenarioResults[j] && scenarioResults[j].state) || "failed");
					if (scenarioState === "passed") {
						passedScenarios++;
					} else if (scenarioState === "failed") {
						failedScenarios++;
					}
				}
			}
			return {
				status: allPassed ? "passed" : "failed",
				summary: {
					totalTests: reports.length,
					passedScenarios: passedScenarios,
					failedScenarios: failedScenarios
				},
				tests: reports
			};
		}

		async function executeScenario(runContext, scenario) {
			if (runContext.loadToken !== loadTokenCounter) {
				return "stale";
			}
			if (!runContext.activeTestClass) {
				setStatus(popupStatus, "Test is still loading. Please wait.", false);
				return "failed";
			}
			setFixedRunProgress({
				phase: "scenario",
				testPath: String((runContext && runContext.selectedPath) || ""),
				scenarioName: String((scenario && scenario.title) || ""),
				scenarioMethodName: String((scenario && scenario.methodName) || "")
			});
			scenarioApi.markScenarioSelection(popupScenariosList, scenario.methodName);
			scenarioApi.setScenarioState(popupScenariosList, scenario.methodName, "idle");
			setStatus(popupStatus, "Running scenario: " + scenario.title, false);
			try {
				await scenarioApi.runScenarioMethod(runContext.activeTestClass, scenario.methodName, {
					testPath: runContext.selectedPath,
					previewElement: runContext.activePreviewElement,
					renderHost: popupRenderHost,
					document: document,
					window: window
				});
				scenarioApi.setScenarioState(popupScenariosList, scenario.methodName, "success");
				storeScenarioResult(runContext, scenario, "passed", "");
				setStatus(popupStatus, "Scenario passed: " + scenario.title, false);
				return "passed";
			} catch (scenarioError) {
				var scenarioErrorText = errorMessage(scenarioError);
				scenarioApi.setScenarioState(popupScenariosList, scenario.methodName, "error");
				storeScenarioResult(runContext, scenario, "failed", scenarioErrorText);
				setStatus(popupStatus, scenarioErrorText, true);
				return "failed";
			}
		}

		async function runPlayAllScenarios(runContext) {
			if (runContext.loadToken !== loadTokenCounter) {
				return {
					status: "stale",
					scenarioResults: []
				};
			}
			if (runContext.selectedScenarios.length === 0) {
				scenarioApi.setPlayAllState(popupScenariosPlayAll, "idle");
				setStatus(popupStatus, "No scenarios were discovered for this test.", false);
				return {
					status: "no-scenarios",
					scenarioResults: []
				};
			}
			if (!runContext.activeTestClass) {
				setStatus(popupStatus, "Test is still loading. Please wait.", false);
				return {
					status: "failed",
					scenarioResults: collectScenarioResults(runContext)
				};
			}

			runContext.scenarioResultByMethod = {};
			scenarioApi.setPlayAllEnabled(popupScenariosPlayAll, false);
			setScenarioButtonsEnabled(false);
			scenarioApi.setPlayAllState(popupScenariosPlayAll, "idle");
			scenarioApi.setAllScenarioStates(popupScenariosList, "idle");
			scenarioApi.markScenarioSelection(popupScenariosList, "");
			try {
				var hasFailures = false;
				for (var i = 0; i < runContext.selectedScenarios.length; i++) {
					var result = await executeScenario(runContext, runContext.selectedScenarios[i]);
					if (result === "stale") {
						return {
							status: "stale",
							scenarioResults: collectScenarioResults(runContext)
						};
					}
					if (result === "failed") {
						hasFailures = true;
					}
				}

				if (hasFailures) {
					scenarioApi.setPlayAllState(popupScenariosPlayAll, "error");
					setStatus(popupStatus, "Play All finished: at least one scenario failed.", true);
					return {
						status: "failed",
						scenarioResults: collectScenarioResults(runContext)
					};
				}

				scenarioApi.setPlayAllState(popupScenariosPlayAll, "success");
				setStatus(popupStatus, "Play All finished: all scenarios passed.", false);
				return {
					status: "passed",
					scenarioResults: collectScenarioResults(runContext)
				};
			} finally {
				setScenarioButtonsEnabled(true);
				scenarioApi.setPlayAllEnabled(popupScenariosPlayAll, runContext.selectedScenarios.length > 0);
			}
		}

		async function loadTestPreview(testPath, shouldRunPlayAll) {
			var selectedPath = String(testPath || "");
			var runContext = {
				selectedPath: selectedPath,
				selectedScenarios: scenarioApi.getScenariosForTest(config, selectedPath),
				loadToken: 0,
				activeTestClass: null,
				activePreviewElement: null,
				scenarioResultByMethod: {}
			};
			setFixedRunProgress({
				phase: "test",
				testPath: selectedPath
			});
			loadTokenCounter++;
			runContext.loadToken = loadTokenCounter;

			scenarioApi.renderScenarioButtons(popupScenariosList, popupScenariosEmpty, runContext.selectedScenarios, async function (scenario) {
				scenarioApi.setPlayAllState(popupScenariosPlayAll, "idle");
				await executeScenario(runContext, scenario);
			});
			scenarioApi.markScenarioSelection(popupScenariosList, "");
			scenarioApi.setPlayAllState(popupScenariosPlayAll, "idle");
			scenarioApi.setPlayAllEnabled(popupScenariosPlayAll, false);

			popupScenariosPlayAll.onclick = async function () {
				await runPlayAllScenarios(runContext);
			};

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
				if (runContext.loadToken !== loadTokenCounter) {
					return {
						status: "stale",
						scenarioResults: []
					};
				}
				var TestClass = resolveTestClass(moduleObject);
				if (!TestClass) {
					throw new Error("No exported '*Test' class (or default class/function) was found.");
				}
				runContext.activeTestClass = TestClass;
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
					scenarioApi.setPlayAllEnabled(popupScenariosPlayAll, runContext.selectedScenarios.length > 0);
					if (runContext.selectedScenarios.length > 0) {
						setStatus(popupStatus, "Choose a scenario from the left panel.", false);
					} else {
						setStatus(popupStatus, "No scenarios were discovered for this unit test.", false);
					}
				} else if (testType === "behavioral") {
					popupBody.textContent = "Please choose a scenario or play with this behavioral test component yourself.";
					var preview = mountBehavioralPreview(popupRenderHost, TestClass, selectedPath);
					runContext.activePreviewElement = preview.element;
					scenarioApi.setPlayAllEnabled(popupScenariosPlayAll, runContext.selectedScenarios.length > 0);
					if (runContext.selectedScenarios.length > 0) {
						setStatus(popupStatus, "Choose a scenario from the left panel.", false);
					} else {
						setStatus(popupStatus, "Behavioral preview is ready. No scenarios were discovered.", false);
					}
				} else {
					throw new Error("Unsupported testType '" + String(testType) + "'. Expected 'unit' or 'behavioral'.");
				}
			} catch (error) {
				if (runContext.loadToken !== loadTokenCounter) {
					return {
						status: "stale",
						scenarioResults: []
					};
				}
				scenarioApi.setPlayAllEnabled(popupScenariosPlayAll, false);
				popupBody.textContent = "Unable to preview this test.";
				setStatus(popupStatus, errorMessage(error), true);
				return {
					status: "failed",
					scenarioResults: []
				};
			}

			if (!shouldRunPlayAll) {
				return {
					status: "loaded",
					scenarioResults: []
				};
			}
			return await runPlayAllScenarios(runContext);
		}

		if (openByDefault) {
			panel.classList.add("lllts-open");
		}
		popupClose.addEventListener("click", closePopup);
		terminalPopupClose.addEventListener("click", closeTerminalPopup);
		setPanelResult("", "");
		syncBackdropState();
		clearFixedLastRunReport();
		clearFixedRunProgress();

		if (tests.length === 0) {
			emptyState.hidden = false;
			setPanelPlayAllEnabled(false);
			var emptyReportText = buildTerminalReport([], true);
			setFixedLastRunReport(emptyReportText, buildTerminalReportJson([], true));
			return;
		}
		emptyState.hidden = true;
		setPanelPlayAllEnabled(true);
		list.textContent = "";

		tests.forEach(function (testPath) {
			var item = document.createElement("li");
			var button = document.createElement("button");
			button.type = "button";
			button.textContent = String(testPath);
			button.setAttribute("data-test-path", String(testPath || ""));
			button.addEventListener("click", async function () {
				if (isRunningAllTests) {
					return;
				}
				await loadTestPreview(testPath, false);
			});
			item.appendChild(button);
			list.appendChild(item);
		});

		async function runPanelPlayAllSequence(_isAutoRun) {
			if (isRunningAllTests || tests.length === 0) {
				return;
			}
			clearFixedLastRunReport();
			clearFixedRunProgress();
			isRunningAllTests = true;
			setPanelPlayAllEnabled(false);
			setListButtonsEnabled(false);

			var hasFailures = false;
			var testReports = [];
			try {
				for (var i = 0; i < tests.length; i++) {
					setPanelResult("running", String(i + 1) + "/" + String(tests.length));
					var testPath = String(tests[i] || "");
					setFixedRunProgress({
						phase: "test",
						testPath: testPath
					});
					var testResult = await loadTestPreview(testPath, true);
					var status = testResult && testResult.status ? String(testResult.status) : "failed";
					var scenarioResults = testResult && Array.isArray(testResult.scenarioResults) ? testResult.scenarioResults : [];
					testReports.push({
						testPath: testPath,
						status: status,
						scenarioResults: scenarioResults
					});
					if (status !== "passed" && status !== "no-scenarios") {
						hasFailures = true;
					}
				}
			} catch (runError) {
				hasFailures = true;
				testReports.push({
					testPath: "<overlay-runner>",
					status: "failed",
					scenarioResults: [
						{
							title: "Play All runtime",
							state: "failed",
							details: errorMessage(runError)
						}
					]
				});
			} finally {
				isRunningAllTests = false;
				setPanelPlayAllEnabled(true);
				setListButtonsEnabled(true);
			}

			var reportText = buildTerminalReport(testReports, !hasFailures);
			var reportJson = buildTerminalReportJson(testReports, !hasFailures);
			openTerminalPopup(reportText);
			setFixedLastRunReport(reportText, reportJson);
			clearFixedRunProgress();

			if (hasFailures) {
				setPanelResult("error", "Failed");
				return;
			}
			setPanelResult("success", "Passed");
		}

		panelPlayAll.addEventListener("click", async function () {
			await runPanelPlayAllSequence(false);
		});

		if (shouldAutoRunFromQuery()) {
			setTimeout(function () {
				void runPanelPlayAllSequence(true);
			}, 0);
		}
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
