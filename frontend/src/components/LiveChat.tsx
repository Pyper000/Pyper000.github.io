import { useEffect, useState } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };
type Product = { id: string; title: string; brand: string; category: string; subcategory: string; price: number; currency: string; highlights: string[]; reason: string; tradeoff: string };
type Result = { text: string; plan: { goal: string; stage: string; budget: number | null; destination: string | null; excludes: string[] }; groups: { name: string; products: Product[] }[] };
type TestRun = {
  test_id: string; tester_id: string; scenario_id: string; version: string; device_type: string;
  start_time: string; end_time: string; duration_sec: number; user_turns: number; assistant_turns: number;
  clarify_turns: number; condition_edits: number; compare_actions: number; product_card_views: number;
  task_completed: string; completion_step: string; abandon_reason: string; satisfaction_1to5: string;
  ease_1to5: string; trust_1to5: string; stuck_step: string; error_count: number; last_conditions: string;
};

const STORAGE_KEY = 'shopmind-usability-tests-v1';
const VERSION = 'live-chat-v1';
const columns: (keyof TestRun)[] = ['test_id', 'tester_id', 'scenario_id', 'version', 'device_type', 'start_time', 'end_time', 'duration_sec', 'user_turns', 'assistant_turns', 'clarify_turns', 'condition_edits', 'compare_actions', 'product_card_views', 'task_completed', 'completion_step', 'abandon_reason', 'satisfaction_1to5', 'ease_1to5', 'trust_1to5', 'stuck_step', 'error_count'];

function readRuns(): TestRun[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(runs: TestRun[]) {
  const csv = [columns.join(','), ...runs.map(run => columns.map(key => csvCell(run[key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `shopmind-usability-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
  URL.revokeObjectURL(url);
}

export default function LiveChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result>();
  const [selected, setSelected] = useState<string[]>([]);
  const [testerId, setTesterId] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [runs, setRuns] = useState<TestRun[]>(readRuns);
  const [activeRun, setActiveRun] = useState<TestRun | null>(() => {
    try { return JSON.parse(localStorage.getItem(`${STORAGE_KEY}-active`) || 'null'); } catch { return null; }
  });
  const [survey, setSurvey] = useState({ task_completed: 'completed', completion_step: 'got_products', abandon_reason: '', satisfaction_1to5: '5', ease_1to5: '5', trust_1to5: '5', stuck_step: '' });
  const base = import.meta.env.VITE_CHAT_BASE || (location.hostname.endsWith('.github.io') ? 'https://pyper000-github-io.vercel.app' : location.origin);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(runs)); }, [runs]);
  useEffect(() => { if (activeRun) localStorage.setItem(`${STORAGE_KEY}-active`, JSON.stringify(activeRun)); else localStorage.removeItem(`${STORAGE_KEY}-active`); }, [activeRun]);

  function patchRun(update: (run: TestRun) => TestRun) {
    setActiveRun(current => current ? update(current) : current);
  }

  function startTest() {
    if (!testerId.trim() || !scenarioId.trim()) return;
    const start = new Date();
    setMessages([]); setResult(undefined); setError(''); setSelected([]);
    setActiveRun({ test_id: crypto.randomUUID(), tester_id: testerId.trim(), scenario_id: scenarioId.trim(), version: VERSION,
      device_type: matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop', start_time: start.toISOString(), end_time: '', duration_sec: 0,
      user_turns: 0, assistant_turns: 0, clarify_turns: 0, condition_edits: 0, compare_actions: 0, product_card_views: 0,
      task_completed: 'running', completion_step: '', abandon_reason: '', satisfaction_1to5: '', ease_1to5: '', trust_1to5: '', stuck_step: '', error_count: 0, last_conditions: '' });
  }

  function finishTest() {
    if (!activeRun) return;
    const end = new Date();
    setRuns(current => [...current, { ...activeRun, ...survey, end_time: end.toISOString(), duration_sec: Math.round((end.getTime() - new Date(activeRun.start_time).getTime()) / 1000) }]);
    setActiveRun(null);
  }

  async function send(query = input, retry = false) {
    if (!query.trim() || busy) return;
    if (!base) { setError('真实对话服务正在部署，请稍后再试。'); return; }
    const history = retry ? messages : [...messages, { role: 'user' as const, content: query }];
    if (activeRun && !retry) patchRun(run => ({ ...run, user_turns: run.user_turns + 1 }));
    setMessages(history); setInput(''); setBusy(true); setError('');
    try {
      const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history }), signal: AbortSignal.timeout(65000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '服务暂时不可用');
      setResult(data); setSelected([]);
      if (activeRun) patchRun(run => {
        const conditions = JSON.stringify([data.plan.budget, data.plan.destination, data.plan.excludes]);
        const before = run.last_conditions ? JSON.parse(run.last_conditions) as unknown[] : null;
        const after = JSON.parse(conditions) as unknown[];
        const edits = before ? after.filter((value, index) => JSON.stringify(value) !== JSON.stringify(before[index])).length : 0;
        const cards = data.groups.reduce((count: number, group: Result['groups'][number]) => count + group.products.length, 0);
        return { ...run, assistant_turns: run.assistant_turns + 1, clarify_turns: run.clarify_turns + (data.plan.stage === 'clarify' ? 1 : 0),
          condition_edits: run.condition_edits + edits, product_card_views: run.product_card_views + cards, last_conditions: conditions };
      });
      setMessages([...history, { role: 'assistant', content: data.text + '\n' + data.groups.map((g: Result['groups'][number]) => `${g.name}: ${g.products.map(p => `${p.id} ${p.title}`).join('、')}`).join('\n') }]);
    } catch (e) { if (activeRun) patchRun(run => ({ ...run, error_count: run.error_count + 1 })); setError(e instanceof Error ? e.message : '请求失败，请重试'); }
    finally { setBusy(false); }
  }
  return <section className="live-section" id="live">
    <div className="section-heading"><p className="eyebrow">PRODUCT / LIVE CONVERSATION</p><h2>和 ShopMind 一起选</h2><p>真实模型对话 · 模拟商品与模拟账户上下文 · 不涉及真实交易</p></div>
    <div className="test-panel">
      <div className="test-panel-head"><strong>前端可用性测试</strong><span>{activeRun ? `记录中 · ${activeRun.scenario_id}` : `本机已保存 ${runs.length} 条`}</span></div>
      {!activeRun ? <div className="test-start">
        <label>测试者编号<input value={testerId} onChange={e => setTesterId(e.target.value)} placeholder="例如 T01（无需填写姓名）" /></label>
        <label>场景编号<input value={scenarioId} onChange={e => setScenarioId(e.target.value)} placeholder="例如 gift-01" /></label>
        <button type="button" disabled={!testerId.trim() || !scenarioId.trim()} onClick={startTest}>开始记录</button>
      </div> : <div className="test-finish">
        <label>任务结果<select value={survey.task_completed} onChange={e => setSurvey(s => ({ ...s, task_completed: e.target.value }))}><option value="completed">完成</option><option value="partial">部分完成</option><option value="abandoned">放弃</option><option value="error">技术问题</option></select></label>
        <label>完成阶段<select value={survey.completion_step} onChange={e => setSurvey(s => ({ ...s, completion_step: e.target.value }))}><option value="understood">理解需求</option><option value="got_directions">获得场景方向</option><option value="got_products">获得商品</option><option value="compared">完成比较</option><option value="confirmed">确认选择</option><option value="none">未完成</option></select></label>
        <label>满意度<select value={survey.satisfaction_1to5} onChange={e => setSurvey(s => ({ ...s, satisfaction_1to5: e.target.value }))}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label>
        <label>顺畅度<select value={survey.ease_1to5} onChange={e => setSurvey(s => ({ ...s, ease_1to5: e.target.value }))}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label>
        <label>推荐可信度<select value={survey.trust_1to5} onChange={e => setSurvey(s => ({ ...s, trust_1to5: e.target.value }))}>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label>
        <label>未完成原因<select value={survey.abandon_reason} onChange={e => setSurvey(s => ({ ...s, abandon_reason: e.target.value }))}><option value="">无/不适用</option><option value="too_many_questions">追问太多</option><option value="irrelevant_products">商品不相关</option><option value="slow_response">响应太慢</option><option value="interface_unclear">界面不清楚</option><option value="technical_error">技术错误</option><option value="other">其他</option></select></label>
        <label>卡点/未完成原因<input value={survey.stuck_step} onChange={e => setSurvey(s => ({ ...s, stuck_step: e.target.value }))} placeholder="可留空；不要填写个人隐私" /></label>
        <button type="button" disabled={busy} onClick={finishTest}>结束并保存</button>
      </div>}
      <div className="test-panel-actions"><button type="button" disabled={!runs.length && !activeRun} onClick={() => downloadCsv(activeRun ? [...runs, { ...activeRun, duration_sec: Math.round((Date.now() - new Date(activeRun.start_time).getTime()) / 1000) }] : runs)}>导出 CSV（{runs.length + (activeRun ? 1 : 0)}）</button><button type="button" disabled={!runs.length && !activeRun} onClick={() => { if (confirm('清除这台设备保存的所有测试记录？')) { setRuns([]); setActiveRun(null); } }}>清空本机记录</button><small>只存本机浏览器，不上传对话内容；换设备不会自动汇总。</small></div>
    </div>
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
      {result.groups.map(g => <div key={g.name} className="live-group"><h3>{g.name}</h3><div className="live-products">{g.products.map((p, index) => <article key={p.id} className="live-product"><div className={`live-product-art tone-${index % 3}`}><span>{p.category}</span><small>{p.subcategory}</small></div><div className="live-product-copy"><div className="live-product-meta"><span>{p.brand}</span><strong>{p.price} {p.currency}</strong></div><h4>{p.title}</h4><p>{p.reason}</p><p className="live-tradeoff"><b>取舍</b>{p.tradeoff}</p><label><input type="checkbox" checked={selected.includes(p.id)} disabled={busy || (!selected.includes(p.id) && selected.length >= 3)} onChange={() => { setSelected(selected.includes(p.id) ? selected.filter(id => id !== p.id) : [...selected, p.id]); if (activeRun) patchRun(run => ({ ...run, compare_actions: run.compare_actions + 1 })); }} /> 加入比较</label></div></article>)}</div></div>)}
      {selected.length >= 2 && <button disabled={busy} onClick={() => { if (activeRun) patchRun(run => ({ ...run, compare_actions: run.compare_actions + 1 })); void send(`比较这些商品 ${selected.join('、')}，结合我的目标给出首选和取舍`); }}>比较已选商品</button>}</>}
    <form className="demo-composer" onSubmit={e => { e.preventDefault(); void send(); }}><input maxLength={1500} value={input} onChange={e => setInput(e.target.value)} placeholder="想买什么，或者想改善生活里的哪件事？" aria-label="真实对话输入" /><button disabled={busy || !input.trim()} type="submit" aria-label="发送真实对话" title="发送">↑</button></form>
    </div>
    <p className="live-note">商品、品牌、价格、库存与配送范围均为虚拟演示数据；价格未含运费，未确认配送地时不能判断可购买性。</p>
  </section>;
}
