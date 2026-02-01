import { useEffect, useMemo, useRef, useState } from 'react'

export default function NewTopicView(props: { onSubmit: (topic: string) => void }) {
  const [value, setValue] = useState('')
  const trimmed = useMemo(() => value.trim(), [value])
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <div className="centerPane">
      <div className="topicCard">
        <div className="topicTitle">想辩论什么话题？</div>
        <div className="topicInputWrapper">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!trimmed) return
              props.onSubmit(trimmed)
            }}
          >
            <textarea
              ref={ref}
              className="topicInput"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                if (e.shiftKey) return
                e.preventDefault()
                if (!trimmed) return
                props.onSubmit(trimmed)
              }}
              placeholder="输入话题，例如：AI 是否会取代程序员..."
              autoFocus
              rows={1}
            />
          </form>
        </div>
      </div>
    </div>
  )
}
