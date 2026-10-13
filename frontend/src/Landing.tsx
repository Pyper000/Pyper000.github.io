import { useEffect, useRef, useState } from "react";
import "./landing.css";
import LiveChat from "./components/LiveChat";

type Product = {
  name: string;
  category: string;
  price: string;
  rating: string;
  reason: string;
  accent: string;
};

type Scenario = {
  id: string;
  prompt: string;
  chips: string[];
  reply: string;
  question: string;
  answer: string;
  directions: string[];
  products: Product[];
};

const scenarios: Scenario[] = [
  {
    id: "mother",
    prompt: "我想给妈妈买母亲节礼物，但我不确定买什么",
    chips: ["送礼对象: 妈妈", "预算: CNY 350", "配送地: 中国"],
    question: "想送得贴心，可以从她平时的习惯入手。妈妈休息时最喜欢做什么？",
    answer: "她喜欢喝茶，也喜欢布置家里。预算350元，寄中国。",
    reply: "可以从茶饮器物、家居氛围两个方向看看。她已经有常用的茶具了吗？如果有，我们就换个方向。",
    directions: ["茶饮仪式感", "日常家居"],
    products: [
      { name: "TerraCotta 粗陶茶具礼盒", category: "茶饮器物", price: "CNY 268", rating: "4.9", reason: "适合喜欢喝茶的妈妈，有仪式感且不容易踩雷。", accent: "violet" },
      { name: "AromaStone 无火扩香礼盒", category: "香氛家居", price: "CNY 99", rating: "4.8", reason: "送礼表达明确，对使用习惯要求低。", accent: "blue" },
    ],
  },
  {
    id: "camp",
    prompt: "预算 500，想买一个适合露营的灯",
    chips: ["预算: CNY 500", "场景: 露营", "品类: 营地灯"],
    question: "露营灯选对了，晚上会省心不少。你主要用来照亮营地，还是放在帐篷里？",
    answer: "主要照亮营地，偶尔放帐篷里，寄中国。",
    reply: "那主灯可以优先看照明范围和续航；折叠灯更方便收纳，应急灯适合备用。你更在意照得亮，还是携带轻便？",
    directions: ["长续航照明", "防水耐用", "轻量收纳"],
    products: [
      { name: "TrailGlow 1000 户外营地灯", category: "露营照明", price: "CNY 229", rating: "4.9", reason: "IPX6 防水，续航 40 小时，符合预算与露营场景。", accent: "sky" },
      { name: "LumaFold 可折叠氛围灯", category: "露营照明", price: "CNY 159", rating: "4.8", reason: "体积小，可作为帐篷内照明与桌面灯使用。", accent: "violet" },
      { name: "Beacon Mini 应急灯", category: "应急照明", price: "CNY 89", rating: "4.6", reason: "适合作为主灯之外的轻量备用方案。", accent: "blue" },
    ],
  },
  {
    id: "headphones",
    prompt: "想买降噪耳机，通勤用",
    chips: ["场景: 通勤", "品类: 降噪耳机", "偏好: 隔绝噪音"],
    question: "想让通勤安静一点。你更喜欢入耳式还是头戴式，或者还没决定？",
    answer: "还没决定，预算400元，主要坐地铁，寄中国。",
    reply: "可以先比较两种佩戴方式：头戴式不用塞进耳朵，入耳式更方便收纳。你平时戴入耳式会不舒服吗？",
    directions: ["主动降噪", "轻量佩戴", "稳定通话"],
    products: [
      { name: "QuietFold ANC Headphones", category: "头戴式耳机", price: "CNY 389", rating: "4.9", reason: "通勤降噪与可折叠收纳兼顾，适合地铁和飞机。", accent: "violet" },
      { name: "FlowPods Pro", category: "真无线耳机", price: "CNY 299", rating: "4.8", reason: "更轻便，适合短途通勤和频繁接听电话。", accent: "blue" },
      { name: "Breeze NC Lite", category: "头戴式耳机", price: "CNY 219", rating: "4.7", reason: "预算友好，保留基础降噪与多设备连接。", accent: "sky" },
    ],
  },
];

function getScenario(query: string): Scenario {
  const text = query.toLowerCase();
  if (/妈妈|母亲|礼物|mother|gift/.test(text)) return scenarios[0];
  if (/露营|camp|营地|户外灯/.test(text)) return scenarios[1];
  if (/耳机|降噪|headphone|commute/.test(text)) return scenarios[2];
  return { ...scenarios[2], prompt: query, chips: ["自然语言需求", "待确认: 预算", "待确认: 使用场景"], reply: "我先把你的表达保留为一个购物任务。补充预算、使用场景或收货地中的任意一个条件后，我就能把推荐范围明显收窄。", directions: ["先确认使用场景", "补充预算范围", "选择优先偏好"] };
}

function ProductCard({ product, compared, onCompare }: { product: Product; compared: boolean; onCompare: () => void }) {
  return (
    <article className="product-card">
      <div className={`product-art ${product.accent}`}><span>{product.category}</span><i /><i /><i /></div>
      <div className="product-copy">
        <div className="product-meta"><span>{product.rating} / 5.0</span><span>{product.price}</span></div>
        <h4>{product.name}</h4>
        <p>{product.reason}</p>
        <button className={compared ? "compare-btn added" : "compare-btn"} type="button" onClick={onCompare}>{compared ? "已加入" : "加入对比"}</button>
      </div>
    </article>
  );
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scenario, setScenario] = useState(scenarios[0]);
  const [query, setQuery] = useState(scenarios[0].prompt);
  const [thinking, setThinking] = useState(true);
  const [typing, setTyping] = useState(false);
  const [typedReply, setTypedReply] = useState("");
  const [compared, setCompared] = useState<string[]>([]);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  const runDemo = (nextQuery: string) => {
    const next = getScenario(nextQuery);
    clearTimers();
    setScenario(next);
    setQuery(nextQuery);
    setThinking(true);
    setTyping(false);
    setTypedReply("");
    timers.current.push(window.setTimeout(() => {
      setThinking(false);
      setTyping(true);
      let index = 0;
      const typeNext = () => {
        index += 1;
        setTypedReply(next.reply.slice(0, index));
        if (index < next.reply.length) timers.current.push(window.setTimeout(typeNext, 16));
        else setTyping(false);
      };
      typeNext();
    }, 720));
  };

  useEffect(() => {
    runDemo(scenarios[0].prompt);
    return clearTimers;
  }, []);

  const toggleCompare = (name: string) => setCompared((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name]);

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#overview"><span className="brand-symbol">S</span><span>ShopMind <b>AI</b></span></a>
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Open navigation"><span /><span /></button>
        <nav className={menuOpen ? "site-nav open" : "site-nav"}>
          {[["Overview", "overview"], ["Dual Modes", "modes"], ["Decision Flow", "orchestration"], ["Demo", "demo"], ["Product", "live"]].map(([item, anchor]) => <a key={item} href={`#${anchor}`} onClick={() => setMenuOpen(false)}>{item}</a>)}
        </nav>
        <div className="header-actions"><a className="case-link" href="#orchestration">View Case Study <span>↗</span></a><a className="primary-btn compact" href="#live">真实对话 <span>↗</span></a></div>
      </header>

      <main>
        <section className="hero" id="overview">
          <div className="hero-copy reveal">
            <p className="eyebrow">CONVERSATIONAL COMMERCE / 01</p>
            <h1>ShopMind AI</h1>
            <h2 className="hero-subtitle">从“不知道买什么”，到找到适合你的选择。</h2>
            <p className="hero-text">不必先想好商品名。聊聊你的生活场景、偏好或顾虑，ShopMind 通过必要的追问，帮你明确方向、筛选商品，再一起比较取舍。</p>
            <div className="hero-actions"><a className="primary-btn" href="#live">开始购物对话 <span>↗</span></a><a className="secondary-btn" href="#orchestration">查看能力 <span>↓</span></a></div>
            <div className="capability-tags"><span>Intent Understanding</span><span>Tool Calling</span><span>Explainable Recommendations</span></div>
          </div>
          <div className="hero-console reveal delayed">
            <div className="console-header"><div>ShopMind Assistant</div><span>场景示例 · 模拟商品</span></div>
            <div className="console-chat"><div className="mini-message user">想让每天通勤轻松一点，但不知道买什么</div><div className="mini-message ai">每天通勤确实不容易。你最想改善的是噪音、背包太重，还是路上不舒服？</div></div>
            <div className="console-chat"><div className="mini-message user">背包太重，想轻便一些。</div><div className="mini-message ai">可以先看换小包或整理随身物品两个方向。BudgetPack 20L 简易背包（39元）适合作为换包候选；ZipPouch 证件收纳包（69元）方便集中小物件，但不会直接减轻重量。你每天需要带电脑吗？目录未提供包体重量和电脑隔层，暂不能确认适配。</div></div>
            <div className="console-glow" />
          </div>
        </section>

        <LiveChat />

        <section className="value-section">
          <div className="section-heading"><p className="eyebrow">WHY SHOPMIND</p><h2>不是多一个聊天框，<span>而是多一条决策链路。</span></h2></div>
          <div className="value-grid">
            {[["01", "⌁", "理解生活场景", "从送礼对象、日常习惯和使用困扰出发，而不只匹配商品关键词。"], ["02", "⌘", "问清关键条件", "每次优先追问一个影响选择的问题，逐步明确偏好、预算与收货地。"], ["03", "✦", "帮助比较取舍", "依据商品信息解释适合谁、有哪些不足，并根据反馈调整推荐。"]].map(([index, icon, title, text]) => (
              <article className="value-card" key={title}><span className="value-index">{index}</span><div className="value-icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>
            ))}
          </div>
        </section>

        <section className="modes-section" id="modes">
          <div className="section-heading split-heading"><div><p className="eyebrow">DUAL MODES</p><h2>同一套能力，<span>两种进入方式。</span></h2></div><p>明确需求时追求效率；需求模糊时让对话帮助用户逐步收敛。</p></div>
          <div className="mode-grid">
            <article className="mode-card">
              <div className="mode-top"><span>01 / SEARCH</span><b>关键词搜索模式</b></div>
              <div className="search-input-demo"><span>⌕</span><p>防水 蓝牙耳机 200-300</p><i>↗</i></div>
              <div className="filter-chips"><span>防水</span><span>蓝牙</span><span>200-300</span></div>
              <p className="mode-copy">快、可控、适合已经知道商品词和筛选条件的用户。</p><div className="mode-line" /><strong>Structured Query → Search → Filter</strong>
            </article>
            <article className="mode-card">
              <div className="mode-top"><span>02 / CONVERSATION</span><b>问答对话模式</b></div>
              <div className="mode-dialog user">我不知道买什么，但想提升通勤幸福感</div><div className="mode-dialog ai">你更在意轻便、收纳，还是降噪？</div>
              <p className="mode-copy chat-copy">更自然、适合模糊需求，也能逐步澄清复杂的购买动机。</p><div className="mode-line" /><strong>Intent → Clarify → Recommend</strong>
            </article>
          </div>
        </section>

        <section className="orchestration-section" id="orchestration">
          <div className="section-heading"><p className="eyebrow">DECISION FLOW</p><h2>不必一次说清，<span>好的选择可以聊出来。</span></h2></div>
          <div className="flow-scroll"><div className="flow">
            {[["01", "表达目标", "想改善什么、给谁买、在哪种场景使用"], ["02", "关键追问", "了解生活习惯与顾虑，不重复问已提供的信息"], ["03", "形成方向", "把模糊目标转成可选择的商品方向"], ["04", "检索与过滤", "从模拟目录选商品，核对预算、库存和配送范围"], ["05", "比较取舍", "比较商品价与已知属性，明确未知信息"], ["06", "反馈收敛", "接受已有、不喜欢或太贵等反馈，保留条件再调整"]].map(([number, title, text], index, items) => (
              <div className="flow-step" key={title}><div className="flow-node" tabIndex={0}><span>{number}</span><b>{title}</b><p>{text}</p></div>{index < items.length - 1 && <div className="flow-connector"><i /></div>}</div>
            ))}
          </div></div>
          <p className="orchestration-note">反馈可以让选择回到追问或检索环节。当前比较基于模拟商品目录，不提供全网实时比价，也不执行真实交易。</p>
        </section>

        <section className="demo-section" id="demo">
          <div className="section-heading split-heading"><div><p className="eyebrow">SCENARIO DEMO</p><h2>场景演示</h2></div><p>预设示例对话 · 商品与价格均为模拟数据</p></div>
          <div className="demo-grid">
            <aside className="prompt-list">
              <p>CHOOSE A SCENARIO</p>
              {scenarios.map((item, index) => <button key={item.id} className={scenario.id === item.id ? "prompt-option active" : "prompt-option"} type="button" onClick={() => runDemo(item.prompt)}><span>0{index + 1}</span><b>{item.prompt}</b><i>↗</i></button>)}
              <div className="signal-card"><span className="online-dot" /><p>SIMULATED AGENT</p><strong>商品、价格与结果均为演示数据</strong></div>
            </aside>
            <div className="demo-console">
              <div className="demo-console-head"><div><span className="assistant-avatar">S</span><b>ShopMind Assistant</b></div><span className={thinking || typing ? "processing-state live" : "processing-state"}>{thinking || typing ? "Thinking" : "Ready"}</span></div>
              <div className="demo-stream">
                <div className="message-wrap user-wrap"><span>YOU</span><div className="demo-message user">{query}</div></div>
                <div className="message-wrap ai-wrap"><span>SHOPMIND</span><div className="demo-message ai">{scenario.question}</div></div>
                <div className="message-wrap user-wrap"><span>YOU · 示例补充</span><div className="demo-message user">{scenario.answer}</div></div>
                <div className="message-wrap ai-wrap"><span>SHOPMIND</span><div className="demo-message ai">{thinking ? <span className="loading-dots"><i /><i /><i /></span> : typedReply}{typing && <span className="typing-caret">|</span>}</div></div>
                {!thinking && typedReply && <><div className="insight-chips">{scenario.chips.map((chip) => <span key={chip}>{chip}</span>)}</div><div className="recommendation-block"><div className="recommendation-title"><span>RECOMMENDATION DIRECTIONS</span><b>推荐方向</b></div><div className="direction-list">{scenario.directions.map((direction) => <span key={direction}>{direction}</span>)}</div></div><div className="demo-product-grid">{scenario.products.map((product) => <ProductCard key={product.name} product={product} compared={compared.includes(product.name)} onCompare={() => toggleCompare(product.name)} />)}</div></>}
              </div>
              <a className="secondary-btn" href="#live">用自己的需求开始真实对话 ↗</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><a className="brand" href="#overview"><span className="brand-symbol">S</span><span>ShopMind <b>AI</b></span></a><p>模拟商品与模拟账户上下文；Product 为真实模型对话，Demo 为预设场景。</p><div><a href="https://github.com/Pyper000/Pyper000.github.io">GitHub</a><a href="#overview">Portfolio</a></div></footer>
    </div>
  );
}
