import { useEffect, useMemo, useState } from 'react'
import genkiData from '../genki_data.json'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Languages,
  LockKeyhole,
  NotebookPen,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react'

const MODES = {
  vocabulary: { label: 'Vocabulario', detail: 'Sustantivos y conceptos', icon: BookOpen },
  verbs: { label: 'Verbos', detail: 'Traducción y conjugaciones', icon: RotateCcw },
  sentences: { label: 'Oraciones', detail: 'Comprensión y traducción', icon: Languages },
}
const TOTAL_QUESTIONS = 10

function shuffle(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[randomIndex]] = [result[randomIndex], result[index]]
  }
  return result
}

function normalizeData(data) {
  if (Array.isArray(data)) return data
  return data?.chapters || data?.lessons || []
}

function JapaneseText({ text, entries }) {
  if (!text || !entries?.length) return <>{text}</>
  const readableEntries = [...entries]
    .filter((entry) => entry.reading && entry.jp && text.includes(entry.jp))
    .sort((left, right) => right.jp.length - left.jp.length)
  if (!readableEntries.length) return <>{text}</>
  const pattern = readableEntries.map((entry) => entry.jp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const parts = text.split(new RegExp(`(${pattern})`))
  return <>{parts.map((part, index) => { const match = readableEntries.find((entry) => entry.jp === part); return match ? <ruby key={`${part}-${index}`}>{part}<rt>{match.reading}</rt></ruby> : <span key={`${part}-${index}`}>{part}</span> })}</>
}

function makeQuestion(bank, mode, questionNumber, lesson) {
  const item = bank[questionNumber % bank.length]
  if (mode === 'vocabulary') {
    const japaneseFirst = Math.random() > 0.5
    const answer = japaneseFirst ? item.es : item.jp
    const distractors = bank.map((entry) => japaneseFirst ? entry.es : entry.jp).filter((value) => value !== answer)
    return { prompt: japaneseFirst ? item.jp : item.es, promptIsJapanese: japaneseFirst, promptLabel: japaneseFirst ? 'Traduce al español' : 'Elige el equivalente en japonés', answer, options: shuffle([answer, ...shuffle([...new Set(distractors)]).slice(0, 3)]) }
  }
  if (mode === 'sentences') {
    const answer = item.es
    return { prompt: item.jp, promptIsJapanese: true, promptLabel: 'Traduce la oración al español', answer, options: shuffle([answer, ...shuffle([...new Set(bank.map((entry) => entry.es).filter((value) => value !== answer))]).slice(0, 3)]) }
  }
  const forms = [['masu', 'forma 〜ます']]
  if (lesson >= 4) forms.push(['past', 'pasado informal'])
  if (lesson >= 6) forms.push(['te', 'forma て'])
  const [form, formLabel] = forms[Math.floor(Math.random() * forms.length)]
  const answer = item[form] || item.es
  const distractors = bank.map((entry) => entry[form] || entry.es).filter((value) => value !== answer)
  return { prompt: item.jp, promptIsJapanese: true, promptLabel: `¿Cuál es la ${formLabel} de ${item.jp}?`, answer, options: shuffle([answer, ...shuffle([...new Set(distractors)]).slice(0, 3)]) }
}

function Header({ progress, score }) {
  return <header className="flex items-center justify-between border-b border-slate-800 pb-5"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300"><span className="jp font-bold">こ</span></div><span className="hidden text-sm font-bold text-slate-300 sm:block">kotoba</span></div><div className="flex items-center gap-5"><div className="flex items-center gap-3"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-700 sm:w-40"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress * 10}%` }} /></div><span className="mono text-xs text-slate-400">{String(progress).padStart(2, '0')} / 10</span></div><div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-400">score <strong className="ml-1 text-cyan-300">{String(score).padStart(2, '0')}</strong></div></div></header>
}

function GrammarNotes({ chapter, onClose }) {
  const lines = (chapter.grammarText || '').split('\n').filter(Boolean)
  return <section className="fade-up mt-8 rounded-2xl border border-amber-300/20 bg-slate-800/90 p-6 shadow-xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="mono text-[10px] uppercase tracking-[0.22em] text-amber-300">apunte / lección {chapter.lesson}</p><h2 className="mt-2 flex items-center gap-2 text-xl font-bold text-white"><NotebookPen size={20} className="text-amber-300" /> Gramática en contexto</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-700 hover:text-white" aria-label="Cerrar apunte"><XCircle size={18} /></button></div><div className="mt-6 max-h-128 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/60 p-5 text-sm leading-7 text-slate-300"><div className="whitespace-pre-wrap">{lines.map((line, index) => { const heading = /^\d+\. /.test(line) || line.endsWith(':'); return <p key={`${line}-${index}`} className={heading ? 'mt-4 first:mt-0 font-semibold text-amber-200' : ''}>{line}</p> })}</div></div><p className="mt-4 text-xs text-slate-500">Este apunte conserva las explicaciones y ejemplos del resumen de Genki.</p></section>
}

function KanjiReview({ chapter, onClose }) {
  const [index, setIndex] = useState(0)
  const [known, setKnown] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const cards = chapter.kanji || []
  const card = cards[index]

  function advance(answeredCorrectly) {
    if (answeredCorrectly) setKnown((value) => value + 1)
    setRevealed(false)
    setIndex((value) => (value + 1) % cards.length)
  }

  if (!cards.length) return <section className="fade-up mt-8 rounded-2xl border border-slate-700 bg-slate-800/90 p-6 text-center text-sm text-slate-400">El resumen empieza el bloque de kanji en la lección 3.</section>
  return <section className="fade-up mt-8 rounded-2xl border border-cyan-300/20 bg-slate-800/90 p-6 shadow-xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">repetición / lección {chapter.lesson}</p><h2 className="mt-2 flex items-center gap-2 text-xl font-bold text-white"><BookOpen size={20} className="text-cyan-300" /> Repaso de kanjis</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-700 hover:text-white" aria-label="Cerrar repaso"><XCircle size={18} /></button></div><div className="mt-6 flex items-center justify-between text-xs text-slate-500"><span>{index + 1} / {cards.length}</span><span className="text-emerald-300">dominados en esta ronda: {known}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${((index + 1) / cards.length) * 100}%` }} /></div><div className="my-7 rounded-2xl border border-slate-700 bg-slate-950/70 px-6 py-10 text-center"><p className="jp text-7xl font-bold text-white">{card.character}</p>{revealed ? <div className="mt-5 space-y-1"><p className="jp text-xl font-bold text-cyan-300">{card.kana}</p><p className="mono mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{card.reading}</p><p className="mt-2 text-sm text-slate-300">{card.meaning}</p></div> : <button type="button" onClick={() => setRevealed(true)} className="mt-6 rounded-lg border border-cyan-400/50 px-4 py-2 text-sm font-bold text-cyan-300 transition hover:bg-cyan-400/10">Mostrar lectura</button>}</div>{revealed && <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => advance(false)} className="rounded-xl border border-rose-300/40 px-4 py-3 text-sm font-bold text-rose-200 transition hover:bg-rose-400/10">Repasar otra vez</button><button type="button" onClick={() => advance(true)} className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400">Lo sé <CheckCircle2 className="ml-1 inline" size={16} /></button></div>}</section>
}

function Menu({ chapters, lesson, setLesson, mode, setMode, startQuiz, readingEntries }) {
  const [showGrammar, setShowGrammar] = useState(false)
  const [showKanji, setShowKanji] = useState(false)
  const chapter = chapters.find((item) => Number(item.lesson) === lesson) || chapters[0]
  return <main className="grid-texture min-h-screen px-5 py-8 sm:px-10 lg:px-16"><div className="mx-auto max-w-6xl"><header className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"><span className="jp text-lg font-bold">こ</span></div><div><p className="mono text-[10px] uppercase tracking-[0.3em] text-cyan-300">ことば / kotoba</p><p className="text-xs text-slate-500">Japanese immersion lab</p></div></div><div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><Sparkles size={14} className="text-amber-300" /> práctica deliberada</div></header><section className="grid gap-12 pb-20 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-24"><div className="fade-up"><div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300"><span className="h-px w-8 bg-cyan-400" /> inmersión activa</div><h1 className="max-w-2xl text-5xl font-extrabold leading-[1.03] tracking-tight text-white sm:text-7xl">Aprende japonés.<br /><span className="text-cyan-300">Piensa en contexto.</span></h1><p className="mt-7 max-w-lg text-base leading-7 text-slate-400">Entrena vocabulario, conjugaciones y comprensión con preguntas que se renuevan en cada sesión.</p><div className="mt-10 flex items-center gap-5 text-xs text-slate-500"><span className="flex items-center gap-2"><LockKeyhole size={14} className="text-emerald-400" /> datos locales</span><span className="h-1 w-1 rounded-full bg-slate-600" /><span>10 preguntas por ronda</span></div></div><div className="fade-up rounded-2xl border border-slate-700/80 bg-slate-800/80 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8"><div className="mb-8 flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-[0.22em] text-slate-500">01 / configuración</p><h2 className="mt-2 text-xl font-bold text-white">Diseña tu sesión</h2></div><CircleHelp size={18} className="text-slate-500" /></div><label className="mb-3 block text-sm font-semibold text-slate-300" htmlFor="lesson">Lección de Genki</label><div className="relative mb-7"><select id="lesson" value={lesson} onChange={(event) => { setLesson(Number(event.target.value)); setShowGrammar(false); setShowKanji(false) }} className="w-full appearance-none rounded-xl border border-slate-600 bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20">{chapters.map((item) => <option key={item.lesson} value={item.lesson}>Lección {item.lesson}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={17} /></div><p className="mb-3 text-sm font-semibold text-slate-300">Modalidad de examen</p><div className="grid gap-2.5">{Object.entries(MODES).map(([key, item]) => { const Icon = item.icon; const selected = mode === key; return <button key={key} type="button" onClick={() => setMode(key)} className={`group flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${selected ? 'border-cyan-400/70 bg-cyan-400/10 text-white' : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}><span className={`grid h-9 w-9 place-items-center rounded-lg ${selected ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-500'}`}><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="mt-0.5 block text-xs text-slate-500">{item.detail}</span></span>{selected && <CheckCircle2 size={18} className="text-cyan-300" />}</button> })}</div><div className="mt-8 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><button type="button" onClick={startQuiz} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-300 active:scale-[.99]">Comenzar práctica <ArrowRight size={17} /></button><button type="button" onClick={() => setShowGrammar((value) => !value)} className="flex items-center justify-center gap-2 rounded-xl border border-amber-300/40 px-4 py-3 text-sm font-bold text-amber-200 transition hover:bg-amber-300/10"><NotebookPen size={16} /> Apunte</button><button type="button" onClick={() => { setShowKanji((value) => !value); setShowGrammar(false) }} className="flex items-center justify-center gap-2 rounded-xl border border-cyan-300/40 px-4 py-3 text-sm font-bold text-cyan-200 transition hover:bg-cyan-300/10"><BookOpen size={16} /> Kanjis</button></div></div></section>{showGrammar && <GrammarNotes chapter={chapter} onClose={() => setShowGrammar(false)} />}{showKanji && <KanjiReview chapter={chapter} onClose={() => setShowKanji(false)} />}<footer className="flex items-center justify-between border-t border-slate-800 pt-5 text-xs text-slate-600"><span>GENKI I · LECCIONES 1—12</span><span className="mono">v1.1 / local mode</span></footer></div></main>
}

function Quiz({ question, index, score, lesson, mode, onAnswer, onNext, readingEntries }) {
  const answered = question.selected !== undefined
  return <main className="min-h-screen px-5 py-6 sm:px-10 lg:px-16"><div className="mx-auto max-w-5xl"><Header progress={index + 1} score={score} /><section className="fade-up mx-auto max-w-3xl pb-16 pt-14"><div className="mb-8 flex items-center justify-between"><div><span className="mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">lección {lesson} · {MODES[mode].label}</span><h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">{question.promptLabel}</h1></div><span className="mono hidden text-5xl font-bold text-slate-800 sm:block">{String(index + 1).padStart(2, '0')}</span></div><div className="mb-10 rounded-2xl border border-slate-700 bg-slate-800/80 px-6 py-10 text-center shadow-xl"><p className="jp text-4xl font-bold leading-relaxed text-white sm:text-5xl">{question.promptIsJapanese ? <JapaneseText text={question.prompt} entries={readingEntries} /> : question.prompt}</p></div><div className="grid gap-3 sm:grid-cols-2">{question.options.map((option, optionIndex) => { const correct = option === question.answer; const incorrect = option === question.selected && !correct; return <button key={`${option}-${optionIndex}`} type="button" disabled={answered} onClick={() => onAnswer(option)} className={`option-enter flex min-h-17.5 items-center gap-4 rounded-xl border px-5 text-left transition-all disabled:cursor-default ${correct && answered ? 'border-emerald-400 bg-emerald-600 text-white' : incorrect ? 'border-rose-400 bg-rose-600 text-white' : `border-slate-700 bg-slate-800/70 text-slate-200 hover:-translate-y-0.5 hover:border-cyan-400 ${answered ? 'opacity-50' : ''}`}`}><span className="mono grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-700 text-xs text-slate-400">{String.fromCharCode(65 + optionIndex)}</span><span className="text-sm font-semibold leading-6"><JapaneseText text={option} entries={readingEntries} /></span>{correct && answered && <CheckCircle2 className="ml-auto shrink-0" size={19} />}{incorrect && <XCircle className="ml-auto shrink-0" size={19} />}</button> })}</div>{answered && <div className="mt-7 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 p-4"><p className={`flex items-center gap-2 text-sm font-semibold ${question.selected === question.answer ? 'text-emerald-300' : 'text-rose-300'}`}>{question.selected === question.answer ? <><CheckCircle2 size={17} /> ¡Respuesta correcta!</> : <><XCircle size={17} /> Era: <span className="text-white">{question.answer}</span></>}</p><button type="button" onClick={onNext} className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-cyan-200">Siguiente <ArrowRight size={15} /></button></div>}</section></div></main>
}

function Results({ score, lesson, mode, restart }) {
  return <main className="grid-texture min-h-screen px-5 py-8 sm:px-10 lg:px-16"><div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col"><header className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-400/10 text-cyan-300"><span className="jp font-bold">こ</span></div><span className="text-sm font-bold text-slate-300">kotoba</span></div><span className="mono text-xs text-slate-500">sesión completada</span></header><section className="fade-up flex flex-1 flex-col items-center justify-center py-16 text-center"><div className="mb-7 grid h-20 w-20 place-items-center rounded-3xl border border-amber-300/30 bg-amber-300/10 text-amber-300"><Trophy size={34} /></div><p className="mono text-[10px] uppercase tracking-[0.25em] text-cyan-300">lección {lesson} · {MODES[mode].label}</p><h1 className="mt-4 text-4xl font-extrabold text-white sm:text-5xl">Ronda terminada</h1><p className="mt-4 text-slate-400">{score >= 8 ? 'Buen ritmo. El contexto ya empieza a quedarse.' : 'Una ronda más y vas a notar la diferencia.'}</p><div className="my-10 grid w-full max-w-md grid-cols-2 divide-x divide-slate-700 rounded-2xl border border-slate-700 bg-slate-800/80 py-6"><div><p className="mono text-4xl font-bold text-cyan-300">{score * 10}%</p><p className="mt-1 text-xs text-slate-500">precisión</p></div><div><p className="mono text-4xl font-bold text-white">{score}<span className="text-lg text-slate-500">/10</span></p><p className="mt-1 text-xs text-slate-500">correctas</p></div></div><button type="button" onClick={restart} className="flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3.5 text-sm font-extrabold text-slate-950 transition hover:bg-cyan-300"><ArrowLeft size={17} /> Volver al menú</button></section><footer className="border-t border-slate-800 pt-5 text-center text-xs text-slate-600">La constancia construye fluidez.</footer></div></main>
}

export default function App() {
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [screen, setScreen] = useState('menu')
  const [lesson, setLesson] = useState(1)
  const [mode, setMode] = useState('vocabulary')
  const [bank, setBank] = useState([])
  const [index, setIndex] = useState(0)
  const [question, setQuestion] = useState(null)
  const [score, setScore] = useState(0)

  useEffect(() => { setChapters(normalizeData(genkiData)); setLoading(false) }, [])

  const readingEntries = useMemo(() => chapters.flatMap((chapter) => [...(chapter.vocabulary || []), ...(chapter.verbs || [])]), [chapters])

  function startQuiz() {
    const selectedLesson = chapters.find((chapter) => Number(chapter.lesson) === lesson)
    const lessonItems = (selectedLesson?.[mode] || []).filter((item) => item.jp && item.es)
    const available = lessonItems
    if (!available.length) return
    const nextBank = shuffle(available)
    setBank(nextBank); setIndex(0); setScore(0); setQuestion(makeQuestion(nextBank, mode, 0, lesson)); setScreen('quiz')
  }

  function answer(selected) {
    if (question.selected !== undefined) return
    setQuestion((current) => ({ ...current, selected }))
    if (selected === question.answer) setScore((current) => current + 1)
  }

  function next() {
    const nextIndex = index + 1
    if (nextIndex >= TOTAL_QUESTIONS) { setScreen('results'); return }
    setIndex(nextIndex); setQuestion(makeQuestion(bank, mode, nextIndex, lesson))
  }

  if (loading) return <div className="app-shell grid min-h-screen place-items-center text-sm text-slate-400">Cargando datos de Genki...</div>
  if (error || !chapters.length) return <div className="app-shell grid min-h-screen place-items-center px-6 text-center"><div><XCircle className="mx-auto mb-4 text-rose-400" size={32} /><p className="text-white">No se pudo cargar el banco de estudio.</p><p className="mt-2 text-sm text-slate-500">{error || 'genki_data.json está vacío.'}</p></div></div>
  if (screen === 'quiz') return <div className="app-shell min-h-screen"><Quiz question={question} index={index} score={score} lesson={lesson} mode={mode} onAnswer={answer} onNext={next} readingEntries={readingEntries} /></div>
  if (screen === 'results') return <div className="app-shell min-h-screen"><Results score={score} lesson={lesson} mode={mode} restart={() => setScreen('menu')} /></div>
  return <div className="app-shell min-h-screen"><Menu chapters={chapters} lesson={lesson} setLesson={setLesson} mode={mode} setMode={setMode} startQuiz={startQuiz} /></div>
}


