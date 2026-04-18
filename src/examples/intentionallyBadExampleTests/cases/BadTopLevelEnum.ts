enum Greetings {
	Hello = "hello",
	Hi = "hi"
}

export class BadTopLevelEnum {
	public static read() {
		return Greetings.Hello
	}
}
