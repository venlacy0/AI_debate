import { useEffect, useMemo, useRef, useState } from 'react'
import { chatViaServerStream } from '../api'
import type { DebateMessage, DebateSession, Side } from '../types'
import { ChevronDownIcon, SendIcon, SpinnerIcon } from './Icons'
import Markdown from './Markdown'

function sideLabel(side: Side) {
  return side === 'pro' ? '正方' : '反方'
}

function displayTitle(title: string) {
  const t = (title || '').trim()
  if (!t) return '未命名话题'
  return t
}

function splitThinking(text: string): { thinking: string | null; answer: string } {
  const m = text.match(/<think>([\s\S]*?)<\/think>/i)
  if (!m) return { thinking: null, answer: text.trim() }
  const thinking = (m[1] ?? '').trim()
  const answer = text.replace(m[0], '').trim()
  return { thinking: thinking || null, answer: answer || '' }
}

function stripThinking(text: string) {
  const { answer } = splitThinking(text)
  return answer || ''
}

function buildPrompt(session: DebateSession, side: Side, round: number) {
  const maxMessages = 10
  const history = session.messages.slice(-maxMessages)
  const historyText =
    history.length === 0
      ? '（暂无）'
      : history
          .map((m) => `${sideLabel(m.side)}·第${m.round}轮：${stripThinking(m.content)}`)
          .join('\n\n')

  const role = sideLabel(side)
  const opponent = side === 'pro' ? '反方' : '正方'

  const system =
    '你在进行中文辩论对话。表达要自然口头、像现场辩手在说话；允许更长输出；必须贴合对方刚说的话进行回应；给出恰当的生活/社会/历史/科技等实例来支撑观点；不要使用emoji；不要编造具体数据来源；不要输出外部链接；不要提到“提示词/系统/模型”。'

  const user = `辩题：${session.title}

已发生的对话（从旧到新，截取最近${maxMessages}条）：
${historyText}

现在轮到你作为${role}发言（第${round}轮）。

要求：
1) 像真实辩论一样说话：短段落、自然、可以有反问、可以接对方的话茬。
2) 不要用“分条/要点/概括”这种格式，也不要写成议论文。
3) 必须回应${opponent}上一轮的核心观点，并给出至少 1 个贴切实例（可以是生活场景、行业案例、历史类比等）。
4) 结尾抛出 1-2 句让对方难接的追问。
5) 允许使用 Markdown 来强调重点（比如 **加粗**、_斜体_、> 引用、\`短代码\`），但不要用列表。

只输出发言内容，不要加标题。`

  return { system, user }
}

export default function DebateView(props: {
  session: DebateSession
  onUpdate: (next: DebateSession) => void
}) {
  const [running, setRunning] = useState(false)
  const [awaitContinue, setAwaitContinue] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingId, setStreamingId] = useState<string | null>(null)

  const sessionRef = useRef(props.session)
  useEffect(() => {
    sessionRef.current = props.session
  }, [props.session])

  const { nextRound, roundsCompleted } = useMemo(() => {
    const byRound = new Map()
    for (const m of props.session.messages) {
      if (!byRound.has(m.round)) byRound.set(m.round, { pro: false, con: false })
      const x = byRound.get(m.round)
      x[m.side] = true
    }

    const rounds = [...byRound.keys()].sort((a, b) => a - b)
    let completed = 0
    for (const r of rounds) {
      const x = byRound.get(r)
      if (x?.pro && x?.con) completed += 1
    }

    let next = 1
    if (rounds.length > 0) {
      for (const r of rounds) {
        const x = byRound.get(r)
        if (!(x?.pro && x?.con)) {
          next = r
          break
        }
        next = r + 1
      }
    }

    return { nextRound: next, roundsCompleted: completed }
  }, [props.session.messages])

  function patchMessageContent(session: DebateSession, id: string, content: string) {
    return {
      ...session,
      messages: session.messages.map((m) => (m.id === id ? { ...m, content } : m)),
      updatedAt: Date.now(),
    }
  }

  function patchMessageReasoning(session: DebateSession, id: string, reasoning: string) {
    return {
      ...session,
      messages: session.messages.map((m) =>
        m.id === id ? { ...m, reasoning } : m,
      ),
      updatedAt: Date.now(),
    }
  }

  async function generateFor(session: DebateSession, side: Side, round: number) {
    const { system, user } = buildPrompt(session, side, round)

    const msgId = crypto.randomUUID()
    const msg: DebateMessage = {
      id: msgId,
      side,
      round,
      content: '',
      reasoning: '',
      createdAt: Date.now(),
    }

    let cur: DebateSession = {
      ...session,
      messages: [...session.messages, msg],
      updatedAt: Date.now(),
    }

    props.onUpdate(cur)
    sessionRef.current = cur

    let contentAcc = ''
    let reasoningAcc = ''
    setStreamingId(msgId)
    const final = await chatViaServerStream(
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.7,
      },
      (ev) => {
        if (ev.type === 'reasoning') {
          reasoningAcc += ev.delta
          const next = patchMessageReasoning(sessionRef.current, msgId, reasoningAcc)
          sessionRef.current = next
          props.onUpdate(next)
          return
        }

        contentAcc += ev.delta
        const next = patchMessageContent(sessionRef.current, msgId, contentAcc)
        sessionRef.current = next
        props.onUpdate(next)
      },
    )

    const finalContent = (final?.content ?? contentAcc).trim()
    const finalReasoning = (final?.reasoning ?? reasoningAcc).trim()
    let finalSession = patchMessageContent(sessionRef.current, msgId, finalContent)
    finalSession = patchMessageReasoning(finalSession, msgId, finalReasoning)
    sessionRef.current = finalSession
    props.onUpdate(finalSession)
    setStreamingId(null)
    return finalSession
  }

  async function runNextRound() {
    setError(null)
    setRunning(true)
    setAwaitContinue(false)
    try {
      const round = nextRound
      let cur = props.session
      cur = await generateFor(cur, 'pro', round)
      cur = await generateFor(cur, 'con', round)
      setAwaitContinue(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误')
    } finally {
      setRunning(false)
    }
  }

  const proMessages = props.session.messages.filter((m) => m.side === 'pro')
  const conMessages = props.session.messages.filter((m) => m.side === 'con')

  return (
    <div className="debatePane">
      <header className="debateHeader">
        <div className="debateTitle" title={displayTitle(props.session.title)}>
          {displayTitle(props.session.title)}
        </div>
      </header>

      {error ? <div className="alert">出错了：{error}</div> : null}

      <div className="columns">
        <section className="column">
          <div className="columnHead pro">正方观点</div>
          <div className="columnBody">
            {proMessages.length === 0 ? (
              <div className="emptyMsg">还没开始。点击下方开始辩论。</div>
            ) : (
              proMessages.map((m, idx) => {
                const prevRound = idx === 0 ? null : proMessages[idx - 1]?.round
                const showDivider = prevRound !== null && prevRound !== m.round

                return (
                  <div key={m.id}>
                    {showDivider ? <div className="roundDivider">第{m.round}轮</div> : null}
                    <article className="msg">
                      <div className="msgMeta">第{m.round}轮</div>
                      {(() => {
                        const legacy = splitThinking(m.content)
                        const thinking =
                          m.reasoning && m.reasoning.trim() ? m.reasoning.trim() : legacy.thinking
                        const answer = m.content.trim() ? m.content.trim() : legacy.answer
                        const isStreaming = streamingId === m.id
                        return (
                          <>
                            {thinking ? (
                              <details className="thinkBox" open={isStreaming}>
                                <summary className="thinkSummary">
                                  <ChevronDownIcon className="thinkIcon" />
                                  思考过程
                                </summary>
                                <Markdown className="thinkContent" content={thinking} />
                              </details>
                            ) : null}
                            <Markdown
                              className={isStreaming && !thinking ? 'msgText typing-cursor' : 'msgText'}
                              content={answer}
                            />
                          </>
                        )
                      })()}
                    </article>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="column">
          <div className="columnHead con">反方观点</div>
          <div className="columnBody">
            {conMessages.length === 0 ? (
              <div className="emptyMsg">还没开始。点击下方开始辩论。</div>
            ) : (
              conMessages.map((m, idx) => {
                const prevRound = idx === 0 ? null : conMessages[idx - 1]?.round
                const showDivider = prevRound !== null && prevRound !== m.round

                return (
                  <div key={m.id}>
                    {showDivider ? <div className="roundDivider">第{m.round}轮</div> : null}
                    <article className="msg">
                      <div className="msgMeta">第{m.round}轮</div>
                      {(() => {
                        const legacy = splitThinking(m.content)
                        const thinking =
                          m.reasoning && m.reasoning.trim() ? m.reasoning.trim() : legacy.thinking
                        const answer = m.content.trim() ? m.content.trim() : legacy.answer
                        const isStreaming = streamingId === m.id
                        return (
                          <>
                            {thinking ? (
                              <details className="thinkBox" open={isStreaming}>
                                <summary className="thinkSummary">
                                  <ChevronDownIcon className="thinkIcon" />
                                  思考过程
                                </summary>
                                <Markdown className="thinkContent" content={thinking} />
                              </details>
                            ) : null}
                            <Markdown
                              className={isStreaming && !thinking ? 'msgText typing-cursor' : 'msgText'}
                              content={answer}
                            />
                          </>
                        )
                      })()}
                    </article>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>

      <div className="continueBar">
        {awaitContinue && !running ? (
          <>
            <div className="continueText">第{roundsCompleted}轮已完成，还要继续吗？</div>
            <div className="continueBtns">
              <button type="button" className="btn btnPrimary" onClick={runNextRound}>
                <SendIcon />
                继续
              </button>
              <button type="button" className="btn" onClick={() => setAwaitContinue(false)}>
                先不继续
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="btn btnPrimary"
            onClick={runNextRound}
            disabled={running}
          >
            {running ? <SpinnerIcon className="spin" /> : <SendIcon />}
            {running
              ? '辩论进行中...'
              : roundsCompleted === 0
                ? '开始辩论'
                : `开始第${nextRound}轮`}
          </button>
        )}
      </div>
    </div>
  )
}
