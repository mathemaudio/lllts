(function (globalScope) {
	function toScenarioTitle(rawTitle, methodName) {
		var title = String(rawTitle || "").trim();
		if (title.length > 0) {
			return title;
		}
		return String(methodName || "scenario");
	}

	function normalizeScenarioEntry(rawEntry) {
		if (!rawEntry || typeof rawEntry !== "object") {
			return null;
		}
		var methodName = String(rawEntry.methodName || "").trim();
		if (methodName.length === 0) {
			return null;
		}
		return {
			methodName: methodName,
			title: toScenarioTitle(rawEntry.title, methodName)
		};
	}

	function getScenariosForTest(config, testPath) {
		if (!config || typeof config !== "object") {
			return [];
		}
		var scenariosByTest = config.testScenarios;
		if (!scenariosByTest || typeof scenariosByTest !== "object") {
			return [];
		}
		var rawEntries = scenariosByTest[String(testPath || "")];
		if (!Array.isArray(rawEntries)) {
			return [];
		}
		var normalized = [];
		for (var i = 0; i < rawEntries.length; i += 1) {
			var entry = normalizeScenarioEntry(rawEntries[i]);
			if (!entry) {
				continue;
			}
			normalized.push(entry);
		}
		return normalized;
	}

	function renderScenarioButtons(listElement, emptyElement, scenarios, onScenarioClick) {
		if (!listElement || !emptyElement) {
			return;
		}
		listElement.textContent = "";
		if (!Array.isArray(scenarios) || scenarios.length === 0) {
			emptyElement.hidden = false;
			return;
		}
		emptyElement.hidden = true;
		for (var i = 0; i < scenarios.length; i += 1) {
			var scenario = scenarios[i];
			var item = document.createElement("li");
			var button = document.createElement("button");
			button.type = "button";
			button.textContent = scenario.title;
			button.setAttribute("data-scenario-method", scenario.methodName);
			button.addEventListener("click", (function (entry) {
				return function () {
					if (typeof onScenarioClick === "function") {
						onScenarioClick(entry);
					}
				};
			})(scenario));
			item.appendChild(button);
			listElement.appendChild(item);
		}
	}

	function markScenarioSelection(listElement, methodName) {
		if (!listElement) {
			return;
		}
		var allButtons = listElement.querySelectorAll("button[data-scenario-method]");
		for (var i = 0; i < allButtons.length; i += 1) {
			var button = allButtons[i];
			if (button.getAttribute("data-scenario-method") === String(methodName || "")) {
				button.setAttribute("data-active", "true");
			} else {
				button.removeAttribute("data-active");
			}
		}
	}

	function createScenarioAssert() {
		return function (condition, message) {
			if (condition) {
				return;
			}
			var description = String(message || "Scenario assertion failed.");
			throw new Error(description);
		};
	}

	async function runScenarioMethod(TestClass, methodName, input) {
		var scenarioMethodName = String(methodName || "").trim();
		if (scenarioMethodName.length === 0) {
			throw new Error("Scenario method name is required.");
		}
		var scenarioFn = TestClass ? TestClass[scenarioMethodName] : undefined;
		if (typeof scenarioFn !== "function") {
			throw new Error("Scenario method '" + scenarioMethodName + "' is not available on this test class.");
		}
		var scenarioInput = input && typeof input === "object" ? input : {};
		await scenarioFn.call(TestClass, scenarioInput, createScenarioAssert());
	}

	globalScope.llltsOverlayScenarios = {
		getScenariosForTest: getScenariosForTest,
		renderScenarioButtons: renderScenarioButtons,
		markScenarioSelection: markScenarioSelection,
		runScenarioMethod: runScenarioMethod
	};
})(typeof window !== "undefined" ? window : globalThis);
