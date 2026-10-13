import { useState } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };
type Product = { id: string; title: string; price: number; currency: string; highlights: string[]; reason: string; tradeoff: string };
type Result = { text: string; plan: { goal: string; stage: string; budget: number | null; destination: string | null; excludes: string[] }; groups: { name: string; products: Product[] }[] };

export default function LiveChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result>();
  const [selected, setSelected] = useState<string[]>([]);
  const base = import.meta.env.VITE_CHAT_BASE || (location.hostname.endsWith('.github.io') ? 'https://pyper000-github-io.vercel.app' : location.origin);
  async function send(query = input, retry = false) {
    if (!query.trim() || busy) return;
    if (!base) { setError('真实对话服务正在部署，请稍后再试。'); return; }
    const history = retry ? messages : [...messages, { role: 'user' as const, content: query }];
    setMessages(history); setInput(''); setBusy(true); setError('');
    try {
      const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history }), signal: AbortSignal.timeout(65000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '服务暂时不可用');
      setResult(data); setSelected([]);
      setMessages([...history, { role: 'assistant', content: data.text + '\n' + data.groups.map((g: Result['groups'][number]) => `${g.name}: ${g.products.map(p => `${p.id} ${p.title}`).join('、')}`).join('\n') }]);
    } catch (e) { setError(e instanceof Error ? e.message : '请求失败，请重试'); }
    finally { setBusy(false); }
  }
  return <section className="live-section" id="live">
    <div className="section-heading"><p className="eyebrow">PRODUCT / LIVE CONVERSATION</p><h2>和 ShopMind 一起选</h2><p>真实模型对话 · 模拟商品与模拟账户上下文 · 不涉及真实交易</p></div>
    <div className="live-console">
    <div className="live-console-head"><strong>ShopMind Assistant</strong><span>{busy ? '正在整理方案' : '准备好帮你选'}</span></div>
    <div className="live-actions"><button disabled={busy} onClick={() => { setMessages([]); setResult(undefined); setError(''); setSelected([]); }}>新对话</button>
      {['想给妈妈买礼物，但不知道买什么', '想让地铁通勤舒服一点', '想让出租屋温馨一点'].map(q => <button disabled={busy} key={q} onClick={() => void send(q)}>{q}</button>)}</div>
    <div className="live-messages" aria-live="polite">{messages.map((m, i) => <div key={i} className={`live-message ${m.role}`}><small>{m.role === 'user' ? '你' : 'ShopMind'}</small><p>{m.role === 'assistant' ? m.content.split('\n').filter(line => !/^.+: P\d/.test(line)).join('\n') : m.content}</p></div>)}
      {!messages.length && <div className="live-message assistant"><small>ShopMind</small><p>还没想好商品名也没关系。你想为谁挑选，或者改善生活里的哪件事？</p></div>}
      {busy && <div className="live-status" role="status"><span className="live-spinner" />正在理解需求、检索并整理方案…</div>}
      {error && <div role="alert">{error} {messages[messages.length - 1]?.role === 'user' && <button onClick={() => void send(messages[messages.length - 1].content, true)}>重试</button>}</div>}
    </div>
    {result && <><div className="insight-chips"><span>目标：{result.plan.goal}</span><span>预算：{result.plan.budget ?? '待确认'} {result.plan.budget ? 'CNY（商品价）' : ''}</span><span>配送地：{result.plan.destination ?? '待确认'}</span>{result.plan.excludes.map(x => <span key={x}>排除：{x}</span>)}</div>
      {result.groups.map(g => <div key={g.name} className="live-group"><h3>{g.name}</h3><div className="live-products">{g.products.map(p => <article key={p.id} className="live-product"><h4>{p.title}</h4><strong>{p.price} {p.currency}</strong><p>{p.reason}</p><p className="live-tradeoff">取舍：{p.tradeoff}</p><label><input type="checkbox" checked={selected.includes(p.id)} disabled={busy || (!selected.includes(p.id) && selected.length >= 3)} onChange={() => setSelected(selected.includes(p.id) ? selected.filter(id => id !== p.id) : [...selected, p.id])} /> 加入比较</label></article>)}</div></div>)}
      {selected.length >= 2 && <button disabled={busy} onClick={() => void send(`比较这些商品 ${selected.join('、')}，结合我的目标给出首选和取舍`)}>比较已选商品</button>}</>}
    <form className="demo-composer" onSubmit={e => { e.preventDefault(); void send(); }}><input maxLength={1500} value={input} onChange={e => setInput(e.target.value)} placeholder="想买什么，或者想改善生活里的哪件事？" aria-label="真实对话输入" /><button disabled={busy || !input.trim()} type="submit" aria-label="发送真实对话" title="发送">↑</button></form>
    </div>
    <p className="live-note">价格为模拟商品价，未含运费；未说明配送地时不能确认可购买性。</p>
  </section>;
}
