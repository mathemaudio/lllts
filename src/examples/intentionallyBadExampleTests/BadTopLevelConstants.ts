const GREETING = "hello"
let mutableValue = "hi"

export class BadTopLevelConstants {
	public static read() {
		return `${GREETING}:${mutableValue}`
	}
}
