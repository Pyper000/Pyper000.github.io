import catalog from './catalog.json' with { type: 'json' };

const active = new Set();
const traffic = new Map();
const destinations = new Set(catalog.flatMap(p => p.ships_to));

export function filterCatalog(plan) {
  return catalog.filter(p => p.stock > 0 &&
    (!plan.destination || p.ships_to.includes(plan.destination)) &&
    (plan.budget == null || (p.currency === 'CNY' && p.price <= plan.budget)) &&
    !plan.excludes.some(term => `${p.title} ${p.description}`.includes(term)));
}

function parseJson(text) {
  return JSON.parse(text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
}

async function model(messages) {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error('MODEL_NOT_CONFIGURED');
  const response = await fetch(`${(process.env.LLM_BASE_URL || 'https://api.siliconflow.cn/v1').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.LLM_MODEL || 'deepseek-ai/DeepSeek-V3.2',
      messages, response_format: { type: 'json_object' }, temperature: 0.3,
      max_tokens: 800, enable_thinking: false }),
    signal: AbortSignal.timeout(28000),
  });
  if (!response.ok) throw new Error(`PROVIDER_${response.status}`);
  const body = await response.json();
  return parseJson(body.choices[0].message.content);
}

export async function decide(history, callModel = model) {
  const planRaw = await callModel([{ role: 'system', content:
    `你是购物需求规划器。只输出JSON。根据对话理解生活目标，不限送礼，也包括通勤、出租屋、旅行。
区分用户事实与假设；不推断年龄、健康、收入，不把收礼人偏好当买家偏好。
同一目标保留已确认预算和目的地，明确改条件则更新，换目标不继承临时条件。
excludes记录用户不要/已拥有的商品词，例如茶具、头戴式；只记录明确排除，不扩大到整个品类。
这是购物决策，不是闲聊。目标是在首次表达加1-2次有效补充内给出场景+商品方案，不承诺固定轮次一定解决。
仅当没有足够线索形成任何合理方向时stage=clarify，一次问最能区分方向的问题，可给2-3个简短选项。
用户已经给出爱好、使用困扰或明确品类时，优先stage=search，先给可调整的方案，再问一个收敛问题；不必把预算、目的地、兴趣逐项问齐才推荐。
例如爸爸喜欢养蜂和钓鱼：可先形成户外便携、钓鱼照明等候选方向，不再只问“选哪个爱好”；库存无对应品类时诚实说明。
避免重复追问、泛泛问“还有什么兴趣”，不把尚未确认的生活习惯当事实。预算和配送地未知时可展示候选，但明确未核实，不声称可购买。
warmth一句自然回应，最多25字，不复述整段需求，不说“为了给你更有针对性的建议”等套话。
澄清回复由warmth加一个question构成，总计80字内，不额外问预算或列长清单。
JSON格式：{goal,stage,warmth,question,budget:null或人民币单件价格上限,destination:null或国家码,excludes:[],preferences:[],directions:[{name,query}]}。
预算口径为模拟商品价，不含运费，不能称为到手价。有总预算但多件组合时不擅自精确分摊。
目的地码可用：${[...destinations].join(',')}；未知目的地保持null并说明待核实，不能假设能配送。
方向最多3个，搜索词具体，不生成订单，不给医疗建议。` }, ...history]);
  const plan = {
    goal: String(planRaw.goal || '').slice(0, 120),
    stage: ['clarify', 'search', 'compare'].includes(planRaw.stage) ? planRaw.stage : 'clarify',
    warmth: String(planRaw.warmth || '').slice(0, 40),
    question: String(planRaw.question || '').slice(0, 100),
    budget: Number.isFinite(planRaw.budget) && planRaw.budget > 0 ? planRaw.budget : null,
    destination: destinations.has(planRaw.destination) ? planRaw.destination : null,
    excludes: Array.isArray(planRaw.excludes) ? planRaw.excludes.filter(x => typeof x === 'string' && x.trim()).slice(0, 10) : [],
    preferences: Array.isArray(planRaw.preferences) ? planRaw.preferences.slice(0, 6).map(String) : [],
    directions: Array.isArray(planRaw.directions) ? planRaw.directions.slice(0, 3) : [],
  };
  if (plan.stage === 'clarify') return { plan, text: `${plan.warmth}\n${plan.question || '你最想改善哪个方面？'}`, groups: [], mode: 'live' };
  const eligible = filterCatalog(plan);
  if (!eligible.length) return { plan, text: `${plan.warmth}\n模拟目录中没有同时满足预算、配送地及排除条件的商品。你愿意调整哪个条件？`, groups: [], mode: 'live' };
  const result = await callModel([{ role: 'system', content:
    `你是购物方案助手，只输出JSON。以下是规则层已过滤的模拟商品目录。
围绕目标给2-3个不同的生活场景方案，每方向最多2件。方向名称体现用途，例如“地铁降噪”“轻量收纳”，不是只有品类名。
只能选择目录内id；明确品类或比较任务可只给一个方向。先提供方案再问一个影响首选的问题，不以泛泛追问代替方案。
不相关时不要硬凑，groups可以为空。不能声称看过浏览记录、买家评价、真实销量或真实物流。
理由和不足必须依据目录，未知属性说未提供；不是医疗功效建议。不能虚构价格、配送和材质。
text最多180字：一句温度回应、简短首选建议、一个下一步问题。不要长开场、总结重复、寒暄或emoji。
每个商品reason/tradeoff各最多45字。JSON：{text,groups:[{name,products:[{id,reason,tradeoff}]}]}。
计划：${JSON.stringify(plan)}
商品：${JSON.stringify(eligible.map(({id,title,price,currency,highlights}) => ({id,title,price,currency,highlights})))}` }, ...history]);
  const byId = new Map(eligible.map(p => [p.id, p]));
  const seen = new Set();
  const groups = (Array.isArray(result.groups) ? result.groups : []).slice(0, 3).map(group => ({
    name: String(group.name || '推荐方向').slice(0, 50),
    products: (Array.isArray(group.products) ? group.products : []).slice(0, 2).flatMap(item => {
      const p = byId.get(item.id);
      if (!p || seen.has(p.id)) return [];
      seen.add(p.id);
      return [{ ...p, reason: String(item.reason || '').slice(0, 80), tradeoff: String(item.tradeoff || '').slice(0, 80) }];
    }),
  })).filter(group => group.products.length);
  return { plan, text: groups.length ? String(result.text || plan.warmth).slice(0, 450) :
    '当前模拟目录里没有足够相关的选择，我不想给你凑一份清单。你愿意尝试哪个其他方向？',
    groups, mode: 'live', trace: { catalogSize: catalog.length, eligible: eligible.length, selected: seen.size,
      retrieval: 'LLM catalog selection with rule constraints; no vector retrieval in this serverless endpoint' } };
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin === 'https://pyper000.github.io' || origin?.startsWith('http://127.0.0.1:')) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: '请使用POST' });
  const body = req.body;
  if (!Array.isArray(body?.history) || body.history.length > 12 || !body.history.length ||
      body.history.some(m => !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 3000) ||
      body.history.at(-1).role !== 'user') return res.status(400).json({ error: '对话格式无效或过长，请新建对话' });
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0];
  const now = Date.now();
  for (const [id, times] of traffic) if (!times.some(t => now - t < 3600000)) traffic.delete(id);
  const times = (traffic.get(ip) || []).filter(t => now - t < 3600000);
  // ponytail: per-instance limits; use a shared quota store for multi-instance production traffic.
  if (times.length >= 20 || active.size >= 2 || active.has(ip)) return res.status(429).json({ error: '演示服务繁忙或达到调用上限，请稍后重试' });
  traffic.set(ip, [...times, now]); active.add(ip);
  try { return res.status(200).json(await decide(body.history)); }
  catch (error) {
    const message = error.message === 'MODEL_NOT_CONFIGURED' ? '在线模型尚未配置' :
      error.message === 'PROVIDER_401' ? '模型认证失败，请联系作品作者' : '模型暂时不可用或处理超时，请重试';
    return res.status(503).json({ error: message });
  } finally { active.delete(ip); }
}
