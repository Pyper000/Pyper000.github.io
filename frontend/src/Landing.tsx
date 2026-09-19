import { type FormEvent, useEffect, useRef, useState } from "react";
import "./landing.css";

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
  directions: string[];
  products: Product[];
};

const scenarios: Scenario[] = [
  {
    id: "mother",
    prompt: "我想给妈妈买母亲节礼物，但我不确定买什么",
    chips: ["送礼对象: 妈妈", "场景: 母亲节", "需求状态: 品类模糊"],
    reply: "这是一个从送礼场景开始的需求，不需要急着猜一个商品名。我会先把“妈妈 + 母亲节”转成适合检索的礼物方向，再用一个偏好问题把结果收窄。",
    directions: ["茶饮仪式感", "舒缓放松", "日常家居"],
    products: [
      { name: "TerraCotta 粗陶茶具礼盒", category: "茶饮器物", price: "CNY 268", rating: "4.9", reason: "适合喜欢喝茶的妈妈，有仪式感且不容易踩雷。", accent: "violet" },
      { name: "AromaStone 无火扩香礼盒", category: "香氛家居", price: "CNY 99", rating: "4.8", reason: "送礼表达明确，对使用习惯要求低。", accent: "blue" },
      { name: "WarmRest 颈肩热敷枕", category: "舒缓护理", price: "CNY 329", rating: "4.7", reason: "适合经常久坐或肩颈容易疲劳的场景。", accent: "sky" },
    ],
  },
  {
    id: "camp",
    prompt: "预算 500，想买一个适合露营的灯",
    chips: ["预算: CNY 500", "场景: 露营", "品类: 营地灯"],
    reply: "我会把预算和使用场景作为硬条件，优先看续航、亮度、防水等级与挂载方式。价格合适但不耐户外使用的商品不会排到前面。",
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
    reply: "通勤场景里，降噪强度并不是唯一指标。我会同时比较佩戴压力、通话表现和收纳便利性，避免推荐只适合安静室内的产品。",
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

function ToolPill({ children, active = false }: { children: string; active?: boolean }) {
  return <span className={`tool-pill ${active ? "is-active" : ""}`}>{children}</span>;
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
  const [input, setInput] = useState("");
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
    setInput("");
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (input.trim()) runDemo(input.trim());
  };

  const toggleCompare = (name: string) => setCompared((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name]);

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#overview"><span className="brand-symbol">S</span><span>ShopMind <b>AI</b></span></a>
        <button className="menu-toggle" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Open navigation"><span /><span /></button>
        <nav className={menuOpen ? "site-nav open" : "site-nav"}>
          {["Overview", "Dual Modes", "Orchestration", "Demo"].map((item) => <a key={item} href={`#${item === "Overview" ? "overview" : item === "Dual Modes" ? "modes" : item.toLowerCase()}`} onClick={() => setMenuOpen(false)}>{item}</a>)}
        </nav>
        <div className="header-actions"><a className="case-link" href="#orchestration">View Case Study <span>↗</span></a><a className="primary-btn compact" href="#demo">Try Demo <span>↗</span></a></div>
      </header>

      <main>
        <section className="hero" id="overview">
          <div className="hero-copy reveal">
            <p className="eyebrow">CONVERSATIONAL COMMERCE / 01</p>
            <h1>让购物，从<span>“搜索”</span>变成“对话”</h1>
            <p className="hero-text">一句话说清你的需求，AI 负责理解意图、调用工具、筛选商品，并给出可解释的推荐。</p>
            <div className="hero-actions"><a className="primary-btn" href="#demo">开始体验 <span>↗</span></a><a className="secondary-btn" href="#orchestration">查看能力 <span>↓</span></a></div>
            <div className="capability-tags"><span>Intent Understanding</span><span>Tool Calling</span><span>Explainable Recommendations</span></div>
          </div>
          <div className="hero-console reveal delayed">
            <div className="console-header"><div><span className="online-dot" /> AI Assistant Online</div><span>LIVE SESSION</span></div>
            <div className="console-chat"><div className="mini-message user">预算 300，想买一个通勤双肩包，耐用一点</div><div className="mini-message ai">我会优先筛选：容量、耐磨材质、背负舒适度、预算区间。</div></div>
            <div className="tool-row"><ToolPill active>parse_intent</ToolPill><ToolPill>search_products</ToolPill><ToolPill>rank_by_preferences</ToolPill></div>
            <div className="mini-products">
              <div className="mini-product"><div className="mini-product-art violet" /><div><b>MetroPack 22L</b><span>CNY 269 · 4.8</span></div><em>01</em></div>
              <div className="mini-product"><div className="mini-product-art blue" /><div><b>Field Daypack</b><span>CNY 299 · 4.7</span></div><em>02</em></div>
            </div>
            <div className="console-glow" />
          </div>
        </section>

        <section className="value-section">
          <div className="section-heading"><p className="eyebrow">WHY SHOPMIND</p><h2>不是多一个聊天框，<span>而是多一条决策链路。</span></h2></div>
          <div className="value-grid">
            {[["01", "⌁", "识别意图", "从自然语言提取预算、偏好、场景、品类，让模糊需求也能进入搜索。"], ["02", "⌘", "调用工具", "结构化调用商品库、检索、排序与物流信息，把回答建立在可用数据上。"], ["03", "✦", "可解释推荐", "告诉用户为什么推荐、为什么过滤，而不是只丢出没有理由的结果列表。"]].map(([index, icon, title, text]) => (
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
          <div className="section-heading"><p className="eyebrow">ORCHESTRATION LAYER</p><h2>把“我想买什么”，<span>编排成可执行的工具链。</span></h2></div>
          <div className="flow-scroll"><div className="flow">
            {[["01", "User Query", "接收自然语言、关键词或多轮补充"], ["02", "Intent Parser", "识别场景、对象、品类、预算与偏好"], ["03", "Tool Router", "根据任务选择检索、库存、物流等工具"], ["04", "Product Search", "关键词与语义检索共同召回候选商品"], ["05", "Ranking", "依据约束和偏好重排，并剔除不可购结果"], ["06", "Response Composer", "组织解释、推荐理由和下一步问题"]].map(([number, title, text], index, items) => (
              <div className="flow-step" key={title}><div className="flow-node" tabIndex={0}><span>{number}</span><b>{title}</b><p>{text}</p></div>{index < items.length - 1 && <div className="flow-connector"><i /></div>}</div>
            ))}
          </div></div>
          <p className="orchestration-note">每次工具调用都可被观测、回放和扩展：库存、价格、物流与优惠券都可以成为可控的能力节点。</p>
        </section>

        <section className="demo-section" id="demo">
          <div className="section-heading split-heading"><div><p className="eyebrow">INTERACTIVE DEMO</p><h2>试试这样问</h2></div><p>不确定买什么也没关系，先说说你的场景。</p></div>
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
                <div className="tool-trace"><ToolPill active={thinking || typing}>parse_intent</ToolPill><ToolPill active={thinking || typing}>search_products</ToolPill><ToolPill active={typing}>rank_by_preferences</ToolPill></div>
                <div className="message-wrap ai-wrap"><span>SHOPMIND</span><div className="demo-message ai">{thinking ? <span className="loading-dots"><i /><i /><i /></span> : typedReply}{typing && <span className="typing-caret">|</span>}</div></div>
                {!thinking && typedReply && <><div className="insight-chips">{scenario.chips.map((chip) => <span key={chip}>{chip}</span>)}</div><div className="recommendation-block"><div className="recommendation-title"><span>RECOMMENDATION DIRECTIONS</span><b>推荐方向</b></div><div className="direction-list">{scenario.directions.map((direction) => <span key={direction}>{direction}</span>)}</div></div><div className="demo-product-grid">{scenario.products.map((product) => <ProductCard key={product.name} product={product} compared={compared.includes(product.name)} onCompare={() => toggleCompare(product.name)} />)}</div></>}
              </div>
              <form className="demo-composer" onSubmit={submit}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="说说你的购物场景、预算或顾虑..." /><button type="submit" disabled={!input.trim() || thinking || typing} aria-label="发送">↑</button></form>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><a className="brand" href="#overview"><span className="brand-symbol">S</span><span>ShopMind <b>AI</b></span></a><p>Conversational shopping, made explainable.</p><div><a href="https://github.com/Pyper000/Ecommerce_portfolio">GitHub</a><a href="#overview">Portfolio</a><a href="mailto:hello@shopmind.ai">Contact</a></div></footer>
    </div>
  );
}
