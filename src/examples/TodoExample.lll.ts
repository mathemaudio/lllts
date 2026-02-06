import { Spec, Out } from "../public/decorators.js"

@Spec("Simple example for LLLTS demonstrating a basic todo list service.")
export class TodoExample {
	private todos: { id: string; text: string; done: boolean; createdAt: number }[] = []

	@Spec("Insert new todo item.")
	@Out("ok", "boolean")
	public add(text: string) {
		const id = `t${Math.floor(Math.random() * 10000)}`
		const createdAt = Date.now()
		this.todos.push({ id, text, done: false, createdAt })
		return true
	}

	@Spec("Switch completion flag.")
	@Out("ok", "boolean")
	public toggle(id: string) {
		const row = this.todos.find(t => t.id === id)
		if (!row) return false
		row.done = !row.done
		return true
	}

	@Spec("Returns current HTML view.")
	@Out("html", "string")
	public render() {
		const list = this.todos
		return /*html*/`
      <div id="root">
        <h3>Todos</h3>
        <input id="newText" placeholder="What to do?" />
        <button id="addBtn" onclick="add">Add</button>
        <ul>
        ${list.map(
			t => `
          <li>
          <input type="checkbox" id="${t.id}" ${t.done ? "checked" : ""} onclick="toggle" />
          <span>${t.text}</span>
          </li>`
		).join("")}
        </ul>
      </div>`
	}

	@Spec("Simple main method for CLI testing.")
	public static main() {
		console.log("Hello LLLTS!")
		const list = new TodoExample()
		list.add("Learn LLLTS")
		document.body.innerHTML = list.render()
	}
}
