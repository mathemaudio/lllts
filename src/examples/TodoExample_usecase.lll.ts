import { Spec, Scenario } from "../public/decorators.js"
import { AssertFn } from "../public/AssertFn.lll"
import { ScenarioWindow } from "../public/ScenarioWindow.lll"
import { TodoExample } from "./TodoExample.lll"

@Spec("Interactive scenarios for the todo component.")
export class TodoExample_usecase {
	environment = "browser"
	static todoExample = new TodoExample()

	static async view(): Promise<string> {
		return /*html*/`
			<section>
				<h2>Todo Example</h2>
				<p>Interact with the todo component to add and toggle items.</p>
				<div id="todo-root">${this.todoExample.render()}</div>
			</section>
		`
	}

	@Scenario("Add and toggle todo")
	static async addAndToggleTodo(window: ScenarioWindow, assert: AssertFn) {
		const host = window.document.getElementById("todo-root")
		assert(host?.tagName === "DIV", "Missing #todo-root host")
		const component = this.todoExample
		const added = component.add("Buy milk")
		assert(added === true, "Should add todo")
		const todos = (component as any).todos as { id: string; text: string; done: boolean }[]
		const first = todos[0]
		assert(first.text === "Buy milk", "Todo text should match input")
		assert(first.done === false, "New todo starts unchecked")
		component.toggle(first.id)
		host.innerHTML = component.render()

		const checkbox = host.querySelector<HTMLInputElement>("input[type='checkbox']")
		assert(checkbox?.checked === true, "Todo should be marked done")
		const text = host.querySelector("span")?.textContent?.trim()
		assert(text === "Buy milk", "Rendered text should match input")
	}
}
