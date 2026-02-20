// Rule code type definition

export type RuleCode =
	// LllClassPerFileRule
	| "no-export"        // No export or multiple exports
	| "name-mismatch"    // Name mismatch with filename
	| "extra-exports"    // Extra exports beyond main class/type
	| "extra-top-level"  // Extra top-level class/type/interface declarations
	| "rogue-top-level"  // Forbidden top-level declarations/statements
	// MustHaveSpecHeaderRule
	| "missing-spec-class"   // No @Spec on class
	| "missing-spec-method"  // No @Spec on method
	// MustHaveDescRule
	| "missing-desc-class"   // No description in class @Spec
	| "missing-desc-method"  // No description in method @Spec
	// MustHaveTestRule
	| "missing-test"         // Test companion missing structure, naming, imports, or scenarios
	| "missing-test-type"    // Test companion missing testType flag
	| "bad-test-type"        // testType flag not set to allowed literal
	| "test-import-boundary" // Production code imported a test file
	// MustHaveOutRule
	| "missing-out"          // Missing @Out when returning value
	| "extra-out"            // Extra @Out when not returning value
	| "bad-out"              // Bad @Out parameters
	// Test coverage
	| "test-coverage"        // Project-wide test coverage debt
	// Test runner
	| "test-failure"         // Scenario or expect failed during execution
