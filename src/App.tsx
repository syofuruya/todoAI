import { useEffect, useState } from "react"

const DEFAULT_CATEGORIES = ["勉強", "家事", "開発"] as const
const CATEGORIES_STORAGE_KEY = "categories"

type Priority = "high" | "medium" | "low"
type View = "main" | "calendar" | "settings"

type Todo = {
  id: string
  title: string
  category: string
  priority: Priority
  completed: boolean
  mood?: number
  /** 完了時の気分メモ（任意） */
  moodNote?: string
  /** 期限 · 日付（YYYY-MM-DD） */
  dueDate?: string
  /** 期限 · 時（0〜23、1時間単位） */
  dueHour?: number
  /** 完了した日時（ISO 8601） */
  completedAt?: string
}

const PRIORITY_LABEL: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
}

function parsePriority(raw: unknown): Priority {
  if (raw === "high" || raw === "medium" || raw === "low") return raw
  return "medium"
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T12:00:00`)
  return !Number.isNaN(d.getTime()) && toDateInputValue(d) === value
}

function parseDueHour(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > 23) {
    return undefined
  }
  return raw
}

function formatDueLabel(dueDate?: string, dueHour?: number): string | null {
  if (!dueDate || !isValidDateInput(dueDate) || dueHour === undefined) return null
  const d = new Date(`${dueDate}T12:00:00`)
  const datePart = d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  })
  return `${datePart} ${dueHour}時`
}

function legacyDueAtToDateHour(iso: string): { dueDate: string; dueHour: number } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return { dueDate: toDateInputValue(d), dueHour: d.getHours() }
}

function legacyDueDayToDate(dueDay: number): string {
  const now = new Date()
  return toDateInputValue(
    new Date(now.getFullYear(), now.getMonth(), dueDay)
  )
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
      const o = item as Partial<Todo> & {
        id?: string
        dueAt?: string
        dueDay?: number
      }
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

      let dueDate: string | undefined =
        typeof o.dueDate === "string" && isValidDateInput(o.dueDate.trim())
          ? o.dueDate.trim()
          : undefined
      let dueHour = parseDueHour(o.dueHour)

      if (
        (dueDate === undefined || dueHour === undefined) &&
        typeof o.dueAt === "string" &&
        o.dueAt.trim() !== ""
      ) {
        const conv = legacyDueAtToDateHour(o.dueAt.trim())
        if (conv) {
          dueDate = conv.dueDate
          dueHour = conv.dueHour
        }
      }

      if (dueDate === undefined || dueHour === undefined) {
        const legacyDay =
          typeof o.dueDay === "number" &&
          Number.isInteger(o.dueDay) &&
          o.dueDay >= 1 &&
          o.dueDay <= 31
            ? o.dueDay
            : undefined
        const legacyHour = parseDueHour(o.dueHour)
        if (legacyDay !== undefined && legacyHour !== undefined) {
          dueDate = legacyDueDayToDate(legacyDay)
          dueHour = legacyHour
        }
      }

      const dueOk =
        dueDate !== undefined &&
        dueHour !== undefined &&
        isValidDateInput(dueDate)
      const completedAt =
        typeof o.completedAt === "string" && o.completedAt.trim() !== ""
          ? o.completedAt.trim()
          : undefined
      const moodNote =
        typeof o.moodNote === "string" && o.moodNote.trim() !== ""
          ? o.moodNote.trim()
          : undefined
      return {
        id: o.id && typeof o.id === "string" ? o.id : crypto.randomUUID(),
        title: typeof o.title === "string" ? o.title : "",
        category,
        priority: parsePriority(o.priority),
        completed: Boolean(o.completed),
        ...(mood !== undefined ? { mood } : {}),
        ...(moodNote !== undefined ? { moodNote } : {}),
        ...(dueOk ? { dueDate, dueHour } : {}),
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
  const [priorityDraft, setPriorityDraft] = useState<Priority>("medium")
  const [hasDueDraft, setHasDueDraft] = useState(false)
  const [dueDateDraft, setDueDateDraft] = useState("")
  const [dueHourDraft, setDueHourDraft] = useState("12")
  const [showCompleted, setShowCompleted] = useState(true)
  const [view, setView] = useState<View>("main")
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [moodTargetId, setMoodTargetId] = useState<string | null>(null)
  const [moodNoteDraft, setMoodNoteDraft] = useState("")

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
    const h = dueHourDraft === "" ? NaN : Number(dueHourDraft)
    const dueOk =
      hasDueDraft &&
      isValidDateInput(dueDateDraft) &&
      !Number.isNaN(h) &&
      Number.isInteger(h) &&
      h >= 0 &&
      h <= 23
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      title: text.trim(),
      category: categoryDraft,
      priority: priorityDraft,
      completed: false,
      ...(dueOk ? { dueDate: dueDateDraft, dueHour: h } : {}),
    }
    setTodos((prev) => [...prev, newTodo])
    setText("")
    setHasDueDraft(false)
    setDueDateDraft("")
    setDueHourDraft("12")
  }

  const setTodoDue = (
    id: string,
    enabled: boolean,
    dateStr: string,
    hourStr: string
  ) => {
    const h = hourStr === "" ? NaN : Number(hourStr)
    const dueOk =
      enabled &&
      isValidDateInput(dateStr) &&
      !Number.isNaN(h) &&
      Number.isInteger(h) &&
      h >= 0 &&
      h <= 23
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        if (!dueOk) return { ...t, dueDate: undefined, dueHour: undefined }
        return { ...t, dueDate: dateStr, dueHour: h }
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
                moodNote: undefined,
                completedAt: undefined,
              }
            : t
        )
      )
      return
    }
    setMoodNoteDraft("")
    setMoodTargetId(id)
  }

  const completeWithMood = (mood: 1 | 2 | 3 | 4 | 5) => {
    if (!moodTargetId) return
    const note = moodNoteDraft.trim()
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === moodTargetId
          ? {
              ...todo,
              completed: true,
              mood,
              ...(note !== "" ? { moodNote: note } : { moodNote: undefined }),
              completedAt: new Date().toISOString(),
            }
          : todo
      )
    )
    setMoodTargetId(null)
    setMoodNoteDraft("")
  }

  const cancelMoodPicker = () => {
    setMoodTargetId(null)
    setMoodNoteDraft("")
  }

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

  const priorityClass = (priority: Priority) => {
    switch (priority) {
      case "high":
        return "bg-rose-500/20 text-rose-300"
      case "medium":
        return "bg-amber-500/20 text-amber-300"
      case "low":
        return "bg-slate-500/30 text-slate-300"
    }
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

  const calendarYear = calendarMonth.getFullYear()
  const calendarMonthIndex = calendarMonth.getMonth()
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate()
  const firstWeekday = new Date(calendarYear, calendarMonthIndex, 1).getDay()
  const calendarCells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  const todosForCalendarDay = (day: number) =>
    todos.filter((t) => {
      if (!t.dueDate || !isValidDateInput(t.dueDate)) return false
      const d = new Date(`${t.dueDate}T12:00:00`)
      return (
        d.getFullYear() === calendarYear &&
        d.getMonth() === calendarMonthIndex &&
        d.getDate() === day
      )
    })

  const shiftCalendarMonth = (delta: number) => {
    setCalendarMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
    )
  }

  const duePreview = (dateStr: string, hourStr: string) => {
    const h = hourStr === "" ? NaN : Number(hourStr)
    if (!isValidDateInput(dateStr) || Number.isNaN(h)) return null
    return formatDueLabel(dateStr, h)
  }

  const renderDueFields = (
    idPrefix: string,
    enabled: boolean,
    dateStr: string,
    hourStr: string,
    onEnabledChange: (enabled: boolean) => void,
    onDateChange: (date: string) => void,
    onHourChange: (hour: string) => void
  ) => {
    const preview = enabled ? duePreview(dateStr, hourStr) : null
    return (
      <div className="rounded-xl border border-slate-700/60 bg-slate-950/30 p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="rounded border-slate-600 bg-slate-900 text-violet-600 focus:ring-violet-500/50"
          />
          期限を設定する（任意）
        </label>
        {enabled && (
          <div className="mt-3 space-y-3">
            <div>
              <label
                htmlFor={`${idPrefix}-date`}
                className="mb-1 block text-xs font-medium text-slate-400"
              >
                日付
              </label>
              <input
                id={`${idPrefix}-date`}
                type="date"
                value={dateStr}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40 [color-scheme:dark]"
              />
            </div>
            <div>
              <label
                htmlFor={`${idPrefix}-hour`}
                className="mb-1 block text-xs font-medium text-slate-400"
              >
                時刻（1時間単位）
              </label>
              <select
                id={`${idPrefix}-hour`}
                value={hourStr}
                onChange={(e) => onHourChange(e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00（{h}時）
                  </option>
                ))}
              </select>
            </div>
            {preview ? (
              <p className="rounded-lg bg-violet-950/40 px-3 py-2 text-xs text-violet-200">
                期限: {preview}
              </p>
            ) : (
              <p className="text-xs text-amber-400/90">日付と時刻を選んでください</p>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderTodoCard = (todo: Todo) => {
    const dueLabel = formatDueLabel(todo.dueDate, todo.dueHour)
    const hasDue = todo.dueDate !== undefined && todo.dueHour !== undefined
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
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs text-violet-300/90">{todo.category}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityClass(todo.priority)}`}
            >
              優先度: {PRIORITY_LABEL[todo.priority]}
            </span>
          </div>
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
              {todo.moodNote && (
                <p className="mt-1 text-sm text-slate-400">
                  メモ: {todo.moodNote}
                </p>
              )}
            </>
          ) : (
            <div className="mt-2">
              {renderDueFields(
                `todo-${todo.id}`,
                hasDue,
                todo.dueDate ?? toDateInputValue(new Date()),
                todo.dueHour !== undefined ? String(todo.dueHour) : "12",
                (enabled) => {
                  if (!enabled) {
                    setTodoDue(todo.id, false, "", "")
                    return
                  }
                  const date = todo.dueDate ?? toDateInputValue(new Date())
                  const hour =
                    todo.dueHour !== undefined ? String(todo.dueHour) : "12"
                  setTodoDue(todo.id, true, date, hour)
                },
                (date) =>
                  setTodoDue(
                    todo.id,
                    true,
                    date,
                    todo.dueHour !== undefined ? String(todo.dueHour) : "12"
                  ),
                (hour) =>
                  setTodoDue(
                    todo.id,
                    true,
                    todo.dueDate ?? toDateInputValue(new Date()),
                    hour
                  )
              )}
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

  const calendarView = (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">カレンダー</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftCalendarMonth(-1)}
            className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-slate-300 transition hover:border-violet-500/50 hover:text-white"
            aria-label="前の月"
          >
            ←
          </button>
          <span className="min-w-[8rem] text-center text-sm font-medium text-slate-200">
            {calendarYear}年{calendarMonthIndex + 1}月
          </span>
          <button
            type="button"
            onClick={() => shiftCalendarMonth(1)}
            className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-slate-300 transition hover:border-violet-500/50 hover:text-white"
            aria-label="次の月"
          >
            →
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        期限が設定されたTodoを、日付ごとに表示します
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
        {["日", "月", "火", "水", "木", "金", "土"].map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarCells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="min-h-[5.5rem] rounded-lg bg-slate-950/20" />
          }
          const dayTodos = todosForCalendarDay(day)
          const isToday =
            day === new Date().getDate() &&
            calendarMonthIndex === new Date().getMonth() &&
            calendarYear === new Date().getFullYear()
          return (
            <div
              key={day}
              className={`min-h-[5.5rem] rounded-lg border p-1.5 text-left ${
                isToday
                  ? "border-violet-500/50 bg-violet-950/30"
                  : "border-slate-700/50 bg-slate-950/40"
              }`}
            >
              <span
                className={`inline-block text-xs font-semibold ${
                  isToday ? "text-violet-300" : "text-slate-400"
                }`}
              >
                {day}
              </span>
              <ul className="mt-1 space-y-0.5">
                {dayTodos.slice(0, 3).map((t) => (
                  <li
                    key={t.id}
                    title={`${t.title}（${t.category} / 優先度${PRIORITY_LABEL[t.priority]}）`}
                    className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                      t.completed
                        ? "bg-slate-700/50 text-slate-500 line-through"
                        : t.priority === "high"
                          ? "bg-rose-500/25 text-rose-200"
                          : t.priority === "medium"
                            ? "bg-amber-500/20 text-amber-200"
                            : "bg-slate-600/40 text-slate-300"
                    }`}
                  >
                    {t.dueHour !== undefined ? `${t.dueHour}時 ` : ""}
                    {t.title}
                  </li>
                ))}
                {dayTodos.length > 3 && (
                  <li className="px-1 text-[10px] text-slate-500">
                    +{dayTodos.length - 3}件
                  </li>
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </>
  )

  const settingsView = (
    <>
      <h2 className="mb-2 text-xl font-bold text-slate-100">カテゴリ設定</h2>
      <p className="mb-6 text-sm text-slate-400">
        Todoに付けるカテゴリを追加・削除できます。最低1つは残ります。
      </p>

      <ul className="mb-6 space-y-2">
        {categories.map((name) => (
          <li
            key={name}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3"
          >
            <span className="font-medium text-slate-200">{name}</span>
            <button
              type="button"
              onClick={() => removeCategory(name)}
              disabled={categories.length <= 1}
              title={
                categories.length <= 1
                  ? "カテゴリは1つ以上必要です"
                  : "削除"
              }
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 transition enabled:hover:border-rose-400/60 enabled:hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              削除
            </button>
          </li>
        ))}
      </ul>

      {categories.length <= 1 && (
        <p className="mb-4 text-xs text-amber-400/90">
          カテゴリが1つだけのときは削除できません
        </p>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
          placeholder="新しいカテゴリ名"
          className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40"
        />
        <button
          type="button"
          onClick={addCategory}
          disabled={newCategoryName.trim() === ""}
          className="shrink-0 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition enabled:hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          追加
        </button>
      </div>
    </>
  )

  const mainView = (
    <>
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
              disabled={
                !categoryDraft ||
                text.trim() === "" ||
                (hasDueDraft &&
                  (!isValidDateInput(dueDateDraft) ||
                    dueHourDraft === "" ||
                    Number.isNaN(Number(dueHourDraft))))
              }
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
            <label
              htmlFor="new-priority"
              className="mb-1 block text-xs text-slate-500"
            >
              優先度
            </label>
            <select
              id="new-priority"
              value={priorityDraft}
              onChange={(e) => setPriorityDraft(parsePriority(e.target.value))}
              className="w-full rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/40"
            >
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
          {renderDueFields(
            "new",
            hasDueDraft,
            dueDateDraft || toDateInputValue(new Date()),
            dueHourDraft,
            (enabled) => {
              setHasDueDraft(enabled)
              if (enabled && dueDateDraft === "") {
                setDueDateDraft(toDateInputValue(new Date()))
              }
            },
            setDueDateDraft,
            setDueHourDraft
          )}
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
    </>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-violet-900/20 backdrop-blur-md sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              感情ログTodo
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              完了時に気分を1〜5で記録します
            </p>
          </div>
          <nav className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("main")}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                view === "main"
                  ? "border-violet-500 bg-violet-600/20 text-white"
                  : "border-slate-600 bg-slate-800/80 text-slate-300 hover:border-violet-500/50"
              }`}
            >
              一覧
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                view === "calendar"
                  ? "border-violet-500 bg-violet-600/20 text-white"
                  : "border-slate-600 bg-slate-800/80 text-slate-300 hover:border-violet-500/50"
              }`}
            >
              カレンダー
            </button>
            <button
              type="button"
              onClick={() => setView("settings")}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                view === "settings"
                  ? "border-violet-500 bg-violet-600/20 text-white"
                  : "border-slate-600 bg-slate-800/80 text-slate-300 hover:border-violet-500/50"
              }`}
            >
              設定
            </button>
          </nav>
        </div>

        {view === "calendar"
          ? calendarView
          : view === "settings"
            ? settingsView
            : mainView}
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
            <label htmlFor="mood-note" className="mt-4 block text-xs text-slate-500">
              気分メモ（任意）
            </label>
            <textarea
              id="mood-note"
              value={moodNoteDraft}
              onChange={(e) => setMoodNoteDraft(e.target.value)}
              placeholder="今の気持ちを文章で…"
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-slate-600 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
            />
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
