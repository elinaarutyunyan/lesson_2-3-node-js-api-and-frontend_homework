import './style.css'
import type { Snapshot } from '../shared/loan.ts'
import { getSnapshot, issue, takeBack } from './api.ts'
import { renderLedger } from './ledger.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main>
    <header><p class="eyebrow">МЕДИАЛАБОРАТОРИЯ · ПУНКТ ВЫДАЧИ</p>
      <h1>Микрофоны для команды</h1>
      <p>Одна запись — выдача от 1 до 3 микрофонов одному получателю.</p></header>
    <section class="stats" aria-label="Количество оборудования">
      <p>Всего в фонде<strong id="stock">—</strong></p>
      <p>На руках<strong id="issued">—</strong></p>
      <p>Доступно<strong id="available">—</strong></p>
    </section>
    <section class="panel"><h2>Новая выдача</h2>
      <form id="form" novalidate><fieldset id="fields" disabled>
        <label>Получатель<input name="borrower" autocomplete="name" placeholder="Имя получателя"></label>
        <label>Количество<input name="quantity" type="number" min="1" max="3" step="1" value="1"></label>
        <button type="submit">Выдать</button>
      </fieldset></form>
      <p id="message" role="status" aria-live="polite">Загрузка…</p>
    </section>
    <section class="panel">
      <div class="toolbar"><h2>Журнал выдач</h2><button id="reload" type="button">Обновить журнал</button></div>
      <p id="list-note">Данные ещё не получены.</p>
      <div class="table-wrap"><table><thead><tr><th>Получатель</th><th>Количество</th><th>Статус</th><th>Действие</th></tr></thead><tbody id="ledger"></tbody></table></div>
    </section>
    <p class="hint">История возвратов остаётся в журнале. Обновление запрашивает данные сервера.</p>
  </main>`

const form = document.querySelector<HTMLFormElement>('#form')!
const fields = document.querySelector<HTMLFieldSetElement>('#fields')!
const reload = document.querySelector<HTMLButtonElement>('#reload')!
const message = document.querySelector<HTMLElement>('#message')!
const ledger = document.querySelector<HTMLElement>('#ledger')!
const note = document.querySelector<HTMLElement>('#list-note')!
let snapshot: Snapshot | null = null
let busy = false

function show(text: string, error = false) {
  message.textContent = text
  message.classList.toggle('error', error)
}

function render() {
  fields.disabled = busy || snapshot === null
  reload.disabled = busy
  document.querySelector('#stock')!.textContent = snapshot ? String(snapshot.stock) : '—'
  renderLedger(ledger, snapshot?.loans ?? [], busy, id => { if (!busy) void submitReturn(id) })
  const loans = snapshot?.loans ?? []
  const issued = loans.reduce((sum, loan) => (loan.status === 'active' ? sum + loan.quantity : sum), 0)
  document.querySelector('#issued')!.textContent = snapshot ? String(issued) : '—'
  document.querySelector('#available')!.textContent = snapshot ? String(snapshot.stock - issued) : '—'
}

function setBusy(value: boolean) { busy = value; render() }

async function load() {
  if (busy) return
  setBusy(true)
  show('Загрузка…')
  try {
    snapshot = await getSnapshot()
    note.textContent = snapshot.loans.length ? '' : 'Журнал пуст.'
    show('Журнал загружен.')
  } catch (error) {
    show(error instanceof Error ? error.message : 'Не удалось загрузить журнал.', true)
    note.textContent = snapshot ? 'Показаны последние загруженные данные.' : 'Данные ещё не получены.'
  } finally { setBusy(false) }
}

form.addEventListener('submit', event => {
  event.preventDefault()
  if (!busy && snapshot) void submitIssue()
})
reload.addEventListener('click', () => { void load() })

async function submitIssue() {
  if (!snapshot) return
  const data = new FormData(form)
  const borrower = String(data.get('borrower') ?? '')
  const quantity = Number(data.get('quantity'))
  setBusy(true)
  show('Отправка…')
  try {
    const loan = await issue({ borrower, quantity })
    snapshot = { ...snapshot, loans: [...snapshot.loans, loan] }
    form.reset()
    show('Выдача сохранена.')
  } catch {
    show('Не удалось сохранить выдачу.', true)
  } finally { setBusy(false) }
}

async function submitReturn(id: string) {
  if (!snapshot) return
  setBusy(true)
  show('Отправка…')
  try {
    const loan = await takeBack(id)
    snapshot = { ...snapshot, loans: snapshot.loans.map(row => (row.id === loan.id ? loan : row)) }
    show('Возврат принят.')
  } catch {
    show('Не удалось принять возврат.', true)
  } finally { setBusy(false) }
}

void load()