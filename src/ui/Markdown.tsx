import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function Markdown(props: { content: string; className?: string }) {
  return (
    <div className={props.className ? `md ${props.className}` : 'md'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{props.content}</ReactMarkdown>
    </div>
  )
}

