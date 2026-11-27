import { randomUUID } from 'node:crypto'
import type { Loan, LoanInput, Snapshot } from '../shared/loan.ts'
import { STOCK } from './seed.ts'
import { store } from './store.ts'
import { HttpError } from './http.ts'

export async function listLoans(url: URL): Promise<Snapshot> {
  const loans = await store.list()
  const values = url.searchParams.getAll('status')
  if (values.length === 0 || (values.length === 1 && values[0] === 'all')) {
    return { stock: STOCK, loans }
  }
  if (values.length !== 1) {
    throw new HttpError(400, 'INVALID_FILTER', 'Параметр status указан несколько раз.')
  }
  const status = values[0]
  if (status !== 'active' && status !== 'returned') {
    throw new HttpError(400, 'INVALID_FILTER', 'Допустимые значения status: all, active, returned.')
  }
  return { stock: STOCK, loans: loans.filter(loan => loan.status === status) }
}

function parseInput(body: unknown): LoanInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'INVALID_INPUT', 'Тело запроса должно быть JSON-объектом.')
  }
  const row = body as Record<string, unknown>
  if (typeof row.borrower !== 'string' || row.borrower.trim().length === 0) {
    throw new HttpError(400, 'INVALID_INPUT', 'Укажите непустое имя получателя.')
  }
  if (
    typeof row.quantity !== 'number' ||
    !Number.isInteger(row.quantity) ||
    row.quantity < 1 ||
    row.quantity > 3
  ) {
    throw new HttpError(400, 'INVALID_INPUT', 'Количество — целое число от 1 до 3.')
  }
  return { borrower: row.borrower.trim(), quantity: row.quantity }
}

function parseReturn(body: unknown): void {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'INVALID_RETURN', 'Тело запроса должно быть JSON-объектом.')
  }
  const row = body as Record<string, unknown>
  if (row.status !== 'returned') {
    throw new HttpError(400, 'INVALID_RETURN', 'Ожидается {"status":"returned"}.')
  }
}

export async function createLoan(body: unknown): Promise<Loan> {
  const input = parseInput(body)
  return store.edit(draft => {
    const issued = draft.reduce((sum, loan) => (loan.status === 'active' ? sum + loan.quantity : sum), 0)
    const available = STOCK - issued
    if (input.quantity > available) {
      throw new HttpError(409, 'NOT_ENOUGH_STOCK', `Недостаточно микрофонов: доступно ${available}.`)
    }
    const loan: Loan = {
      id: randomUUID(),
      borrower: input.borrower,
      quantity: input.quantity,
      status: 'active',
    }
    draft.push(loan)
    return loan
  })
}

export async function returnLoan(id: string, body: unknown): Promise<Loan> {
  parseReturn(body)
  return store.edit(draft => {
    const loan = draft.find(row => row.id === id)
    if (!loan) {
      throw new HttpError(404, 'NOT_FOUND', 'Выдача не найдена.')
    }
    if (loan.status === 'active') {
      loan.status = 'returned'
    }
    return { ...loan }
  })
}