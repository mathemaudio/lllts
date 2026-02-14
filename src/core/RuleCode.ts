// Rule code type definition

export type RuleCode =
	// LllClassPerFileRule
	| "no-export"        // No export or multiple exports
	| "name-mismatch"    // Name mismatch with filename
	| "extra-exports"    // Extra exports beyond main class/type
	// MustHaveSpecHeaderRule
	| "missing-spec-class"   // No @Spec on class
	| "missing-spec-method"  // No @Spec on method
	// MustHaveDescRule
	| "missing-desc-class"   // No description in class @Spec
	| "missing-desc-method"  // No description in method @Spec
	// MustHaveUsecaseRule
	| "missing-usecase"      // Usecase companion missing browser render contract or scenarios
	| "missing-environment"  // Usecase companion missing environment flag
	| "bad-environment"      // Environment flag not set to allowed literal
	// MustHaveOutRule
	| "missing-out"          // Missing @Out when returning value
	| "extra-out"            // Extra @Out when not returning value
	| "bad-out"              // Bad @Out parameters
	// Use-case coverage
	| "usecase-coverage"     // Project-wide use-case coverage debt
	// Use case runner
	| "usecase-failure"      // Scenario or expect failed during execution
