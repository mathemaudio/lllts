import { Spec } from "../../public/lll.lll"

// Rule code type definition

Spec("RuleCode union of all supported diagnostics.")
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
	| "missing-spec-type"    // No leading Spec(...) call on exported type
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
	// File length
	| "file-too-long"        // Non-test file exceeds 900 lines
	// Method length
	| "method-too-long"      // Method body exceeds 200 lines
	// Folder breadth
	| "folder-too-many-files"
	| "folder-too-many-folders"
	// Control-flow restrictions
	| "assignment-in-conditions"    // Assignment expressions are forbidden inside supported condition positions
	| "no-loose-equality"           // Loose equality operators are forbidden
	| "no-implicit-truthiness"      // Conditions must be statically boolean instead of relying on truthiness
	| "switch-fallthrough"          // Switch clauses must terminate or include an explicit fallthrough marker
	| "no-ignored-promises"         // Promise-valued expression statements must be handled explicitly
	| "no-floating-promises"        // Promise values created in async code must be awaited, returned, or combined explicitly
	| "no-implicit-primitive-coercion" // Arithmetic operators require operands statically known to be numeric
	| "no-any"                      // Explicit any is forbidden
	| "no-non-null-assertion"       // Postfix non-null assertions are forbidden
