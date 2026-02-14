function helperGreeting() {
	return "hello"
}

export class BadTopLevelFunction {
	public static read() {
		return helperGreeting()
	}
}
