import { useEffect, useState } from "react"

const DEFAULT_CATEGORIES = ["勉強", "家事", "開発"] as const
const CATEGORIES_STORAGE_KEY = "categories"

type Todo = {
  id: string
  title: string
  category: string
  completed: boolean
  mood?: number
  /** 期限 · 日にち（1〜31） */
  dueDay?: number
  /** 期限 · 時（0〜23、1時間単位） */
  dueHour?: number
  /** 完了した日時（ISO 8601） */
  completedAt?: string
}

function parseStoredCategories(raw: string | null): string[] {
  if (!raw) return [...DEFAULT_CATEGORIES]
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return [...DEFAULT_CATEGORIES]
    const names = data
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim())
      .filter((c) => c !== "")
    return names.length > 0 ? names : [...DEFAULT_CATEGORIES]
  } catch {
    return [...DEFAULT_CATEGORIES]
  }
}
// 日付と時刻を受け取って文字列を作る関数

function formatDueLabel(d?: number, h?: number): string | null {
  if (
    d === undefined ||
    h === undefined ||
    !Number.isInteger(d) ||
    d < 1 ||
    d > 31 ||
    !Number.isInteger(h) ||
    h < 0 ||
    h > 23
  ) {
    return null
  }
  return `${d}日 ${h}時`
}

// iso形式の日時データを日と時間に変換する関数

function legacyDueAtToDayHour(iso: string): { dueDay: number; dueHour: number } | null {
  const d = new Date(iso) // 日時オブジェクト
  if (Number.isNaN(d.getTime())) return null
  return { dueDay: d.getDate(), dueHour: d.getHours() }
}

function parseStoredTodos(
  raw: string | null,
  categories: string[]
): Todo[] {
  if (!raw) return []
  const fallbackCategory = categories[0] ?? DEFAULT_CATEGORIES[0]
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.map((item): Todo => {
      const o = item as Partial<Todo> & { id?: string; dueAt?: string }
      const category =
        typeof o.category === "string" &&
        o.category.trim() !== "" &&
        categories.includes(o.category.trim())
          ? o.category.trim()
          : fallbackCategory
      const mood =
        typeof o.mood === "number" &&
        Number.isInteger(o.mood) &&
        o.mood >= 1 &&
        o.mood <= 5
          ? o.mood
          : undefined
      let dueDay: number | undefined
      let dueHour: number | undefined
      if (
        typeof o.dueDay === "number" &&
        Number.isInteger(o.dueDay) &&
        o.dueDay >= 1 &&
        o.dueDay <= 31
      ) {
        dueDay = o.dueDay
      }
      if (
        typeof o.dueHour === "number" &&
        Number.isInteger(o.dueHour) &&
        o.dueHour >= 0 &&
        o.dueHour <= 23
      ) {
        dueHour = o.dueHour
      }
      if (
        (dueDay === undefined || dueHour === undefined) &&
        typeof o.dueAt === "string" &&
        o.dueAt.trim() !== ""
      ) {
        const conv = legacyDueAtToDayHour(o.dueAt.trim())
        if (conv) {
          dueDay = conv.dueDay
          dueHour = conv.dueHour
        }
      }
      const dueOk =
        dueDay !== undefined &&
        dueHour !== undefined &&
        dueDay >= 1 &&
        dueDay <= 31 &&
        dueHour >= 0 &&
        dueHour <= 23
      const completedAt =
        typeof o.completedAt === "string" && o.completedAt.trim() !== ""
          ? o.completedAt.trim()
          : undefined
      return {
        id: o.id && typeof o.id === "string" ? o.id : crypto.randomUUID(),
        title: typeof o.title === "string" ? o.title : "",
        category,
        completed: Boolean(o.completed),
        ...(mood !== undefined ? { mood } : {}),
        ...(dueOk ? { dueDay, dueHour } : {}),
        ...(completedAt !== undefined ? { completedAt } : {}),
      }
    })
  } catch {
    return []
  }
}

function App() {
  const [categories, setCategories] = useState<string[]>(() =>
    parseStoredCategories(localStorage.getItem(CATEGORIES_STORAGE_KEY))
  )
  const [todos, setTodos] = useState<Todo[]>(() => {
    const cats = parseStoredCategories(
      localStorage.getItem(CATEGORIES_STORAGE_KEY)
    )
    return parseStoredTodos(localStorage.getItem("todos"), cats)
  })
  const [text, setText] = useState("")
  const [categoryDraft, setCategoryDraft] = useState(
    () =>
      parseStoredCategories(localStorage.getItem(CATEGORIES_STORAGE_KEY))[0] ??
      DEFAULT_CATEGORIES[0]
  )
  const [newCategoryName, setNewCategoryName] = useState("")
  const [dueDayDraft, setDueDayDraft] = useState("")
  const [dueHourDraft, setDueHourDraft] = useState("")
  const [showCompleted, setShowCompleted] = useState(true)
  const [showCategorySettings, setShowCategorySettings] = useState(false)
  const [moodTargetId, setMoodTargetId] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem("todos", JSON.stringify(todos))
  }, [todos])

  useEffect(() => {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories))
  }, [categories])

  const addCategory = () => {
    const name = newCategoryName.trim()
    if (name === "") return
    if (categories.includes(name)) {
      alert("同じ名前のカテゴリが既にあります")
      return
    }
    setCategories((prev) => [...prev, name])
    setNewCategoryName("")
  }

  const removeCategory = (name: string) => {
    if (categories.length <= 1) return
    const fallback = categories.find((c) => c !== name) ?? categories[0]
    setCategories((prev) => prev.filter((c) => c !== name))
    setTodos((prev) =>
      prev.map((t) => (t.category === name ? { ...t, category: fallback } : t))
    )
    if (categoryDraft === name) setCategoryDraft(fallback)
  }

  const addTodo = () => {
    if (text.trim() === "") return
    if (!categoryDraft || !categories.includes(categoryDraft)) return
    const d = dueDayDraft === "" ? NaN : Number(dueDayDraft)
    const h = dueHourDraft === "" ? NaN : Number(dueHourDraft)
    const dueOk =
      !Number.isNaN(d) &&
      Number.isInteger(d) &&
      d >= 1 &&
      d <= 31 &&
      !Number.isNaN(h) &&
      Number.isInteger(h) &&
      h >= 0 &&
      h <= 23
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      title: text.trim(),
      category: categoryDraft,
      completed: false,
      ...(dueOk ? { dueDay: d, dueHour: h } : {}),
    }
    setTodos((prev) => [...prev, newTodo])
    setText("")
    setDueDayDraft("")
    setDueHourDraft("")
  }

  const setTodoDue = (id: string, dayStr: string, hourStr: string) => {
    const d = dayStr === "" ? NaN : Number(dayStr)
    const h = hourStr === "" ? NaN : Number(hourStr)
    const dueOk =
      !Number.isNaN(d) &&
      Number.isInteger(d) &&
      d >= 1 &&
      d <= 31 &&
      !Number.isNaN(h) &&
      Number.isInteger(h) &&
      h >= 0 &&
      h <= 23
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        if (!dueOk) return { ...t, dueDay: undefined, dueHour: undefined }
        return { ...t, dueDay: d, dueHour: h }
      })
    )
  }

  const toggleTodo = (id: string) => {
    const todo = todos.find((t) => t.id === id)
    if (!todo) return
    if (todo.completed) {
      setTodos((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                completed: false,
                mood: undefined,
                completedAt: undefined,
              }
            : t
        )
      )
      return
    }
    setMoodTargetId(id)
  }

  const completeWithMood = (mood: 1 | 2 | 3 | 4 | 5) => {
    if (!moodTargetId) return
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === moodTargetId
          ? {
              ...todo,
              completed: true,
              mood,
              completedAt: new Date().toISOString(),
            }
          : todo
      )
    )
    setMoodTargetId(null)
  }

  const cancelMoodPicker = () => setMoodTargetId(null)

  const deleteTodo = (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  const formatCompletedAt = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    })
  }

  const moodEmoji = (mood?: number) => {
    switch (mood) {
      case 1:
        return "😫"
      case 2:
        return "😢"
      case 3:
        return "😐"
      case 4:
        return "😊"
      case 5:
        return "😄"
      default:
        return ""
    }
  }

  const activeTodos = todos.filter((t) => !t.completed)
  const completedTodos = todos.filter((t) => t.completed)

  const moodTargetTitle =
    todos.find((t) => t.id === moodTargetId)?.title ?? ""

  const renderTodoCard = (todo: Todo) => {
    const dueLabel = formatDueLabel(todo.dueDay, todo.dueHour)
    return (
    <div
      key={todo.id}
      className={`rounded-xl border p-4 shadow-sm transition ${
        todo.completed
          ? "border-slate-600/60 bg-slate-800/40"
          : "border-violet-500/25 bg-slate-800/70 hover:border-violet-400/40"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p
            className={`text-lg font-semibold ${
              todo.completed ? "text-slate-500 line-through" : "text-slate-100"
            }`}
          >
            {todo.title}
          </p>
          <p className="mt-1 text-xs text-violet-300/90">{todo.category}</p>
          {todo.completed ? (
            <>
              {dueLabel && (
                <p className="mt-1 text-sm text-slate-500">期限: {dueLabel}</p>
              )}
              {todo.completedAt && (
                <p className="mt-0.5 text-sm text-slate-500">
                  完了: {formatCompletedAt(todo.completedAt)}
                </p>
              )}
              {todo.mood !== undefined && (
                <p className="mt-1 text-sm text-slate-400">
                  気分: {todo.mood} {moodEmoji(todo.mood)}
                </p>
              )}
            </>
          ) : (
            <div className="mt-2">
              <p className="mb-1 text-xs text-slate-500">
                期限（任意）· 日にちと時（1時間ごと）
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  id={`due-day-${todo.id}`}
                  aria-label="期限の日"
                  value={todo.dueDay !== undefined ? String(todo.dueDay) : ""}
                  onChange={(e) =>
                    setTodoDue(todo.id, e.target.value, String(todo.dueHour ?? ""))
                  }
                  className="min-w-[7rem] flex-1 rounded-lg border border-slate-600/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                >
                  <option value="">日: 未設定</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}日
                    </option>
                  ))}
                </select>
                <select
                  id={`due-hour-${todo.id}`}
                  aria-label="期限の時"
                  value={todo.dueHour !== undefined ? String(todo.dueHour) : ""}
                  onChange={(e) =>
                    setTodoDue(todo.id, String(todo.dueDay ?? ""), e.target.value)
                  }
                  className="min-w-[7rem] flex-1 rounded-lg border border-slate-600/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                >
                  <option value="">時: 未設定</option>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h}時
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {todo.completed ? (
            <button
              type="button"
              onClick={() => toggleTodo(todo.id)}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-500"
            >
              未完了に戻す
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => toggleTodo(todo.id)}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-500"
              >
                完了
              </button>
              <button
                type="button"
                onClick={() => deleteTodo(todo.id)}
                className="rounded-lg border border-slate-500/80 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:border-rose-400/60 hover:text-rose-200"
              >
                削除
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-violet-900/20 backdrop-blur-md sm:p-8">
        <h1 className="mb-2 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          感情ログTodo
        </h1>
        <p className="mb-6 text-center text-sm text-slate-400">
          完了時に気分を1〜5で記録します
        </p>

        <section className="mb-8 rounded-2xl border border-slate-700/80 bg-slate-950/40 p-4">
          <button
            type="button"
            onClick={() => setShowCategorySettings((v) => !v)}
            className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-200"
          >
            カテゴリ設定
            <span className="text-slate-500">
              {showCategorySettings ? "▲" : "▼"}
            </span>
          </button>
          {showCategorySettings && (
            <div className="mt-4 space-y-4">
              <ul className="space-y-2">
                {categories.map((name) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2"
                  >
                    <span className="text-sm text-slate-200">{name}</span>
                    <button
                      type="button"
                      onClick={() => removeCategory(name)}
                      disabled={categories.length <= 1}
                      title={
                        categories.length <= 1
                          ? "カテゴリは1つ以上必要です"
                          : "削除"
                      }
                      className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-300 transition enabled:hover:border-rose-400/60 enabled:hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      削除
                    </button>
                  </li>
                ))}
              </ul>
              {categories.length <= 1 && (
                <p className="text-xs text-amber-400/90">
                  カテゴリが1つだけのときは削除できません
                </p>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                  placeholder="新しいカテゴリ名（1つずつ追加）"
                  className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
                />
                <button
                  type="button"
                  onClick={addCategory}
                  disabled={newCategoryName.trim() === ""}
                  className="shrink-0 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white transition enabled:hover:bg-slate-600 disabled:opacity-40"
                >
                  追加
                </button>
              </div>
            </div>
          )}
        </section>

        <div className="mb-8 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
              placeholder="Todoを入力"
              className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-slate-100 outline-none ring-violet-500/40 placeholder:text-slate-500 focus:border-violet-500 focus:ring-2"
            />
            <button
              type="button"
              onClick={addTodo}
              disabled={!categoryDraft || text.trim() === ""}
              className="shrink-0 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-900/40 transition enabled:hover:bg-violet-500 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              追加
            </button>
          </div>
          <div>
            <label
              htmlFor="new-category"
              className="mb-1 block text-xs text-slate-500"
            >
              カテゴリ（必須）
            </label>
            <select
              id="new-category"
              value={categoryDraft}
              onChange={(e) => setCategoryDraft(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40"
            >
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">
              期限（任意）· 日にちと時（1時間ごと）
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                id="new-due-day"
                aria-label="期限の日"
                value={dueDayDraft}
                onChange={(e) => setDueDayDraft(e.target.value)}
                className="min-w-[7rem] flex-1 rounded-xl border border-slate-600 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="">日: 未設定</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}日
                  </option>
                ))}
              </select>
              <select
                id="new-due-hour"
                aria-label="期限の時"
                value={dueHourDraft}
                onChange={(e) => setDueHourDraft(e.target.value)}
                className="min-w-[7rem] flex-1 rounded-xl border border-slate-600 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40"
              >
                <option value="">時: 未設定</option>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {h}時
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {todos.length === 0 ? (
          <p className="text-center text-slate-500">Todoがまだありません</p>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                進行中 ({activeTodos.length})
              </h2>
              {activeTodos.length === 0 ? (
                <p className="text-sm text-slate-500">進行中のTodoはありません</p>
              ) : (
                <div className="space-y-3">{activeTodos.map(renderTodoCard)}</div>
              )}
            </section>

            {completedTodos.length > 0 && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    完了 ({completedTodos.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowCompleted((v) => !v)}
                    className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-violet-500/50 hover:text-white"
                  >
                    {showCompleted ? "完了を隠す" : "完了を表示"}
                  </button>
                </div>
                {showCompleted && (
                  <div className="space-y-3">
                    {completedTodos.map(renderTodoCard)}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>

      {moodTargetId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mood-dialog-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3
              id="mood-dialog-title"
              className="text-center text-lg font-semibold text-white"
            >
              今の気分は？
            </h3>
            <p className="mt-2 line-clamp-2 text-center text-sm text-slate-400">
              「{moodTargetTitle}」を完了します
            </p>
            <p className="mt-1 text-center text-xs text-slate-500">
              1（つらい）〜 5（最高）
            </p>
            <div className="mt-6 grid grid-cols-5 gap-2">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => completeWithMood(n)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-slate-600 bg-slate-800 py-3 text-sm font-medium text-slate-200 transition hover:border-violet-500 hover:bg-violet-600/20 hover:text-white"
                >
                  <span className="text-xl">{moodEmoji(n)}</span>
                  <span>{n}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={cancelMoodPicker}
              className="mt-4 w-full rounded-xl border border-slate-600 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
