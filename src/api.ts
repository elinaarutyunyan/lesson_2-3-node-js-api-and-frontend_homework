import type { Loan, LoanInput, Snapshot } from '../shared/loan.ts'

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try { response = await fetch(path, options) }
  catch { throw new Error('Нет связи с сервером. Проверьте API и повторите действие вручную.') }
  const text = await response.text()
  let body: { data?: T; error?: { message?: string } } | null = null
  try { body = JSON.parse(text) } catch { }
  if (!response.ok) throw new Error(body?.error?.message ?? 'HTTP ' + response.status + '. Проверьте терминал API.')
  if (body === null || typeof body !== 'object' || !('data' in body)) throw new Error('Неожиданный ответ API.')
  return body.data as T
}

export const getSnapshot = (): Promise<Snapshot> => request('/api/loans')

export function issue(input: LoanInput): Promise<Loan> {
  return request<Loan>('/api/loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function takeBack(id: string): Promise<Loan> {
  return request<Loan>('/api/loans/' + encodeURIComponent(id), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'returned' }),
  })
}