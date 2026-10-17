import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, filterCatalog } from './chat.mjs';
import catalog from './catalog.json' with { type: 'json' };
import taxonomy from './category-taxonomy.json' with { type: 'json' };

test('simulated catalog covers core categories and every mapped subcategory', () => {
  const required = ['旅行装备', '数码配件', '家居生活', '户外运动', '服饰鞋包', '食品饮料', '厨房与小家电', '美妆个护', '办公学习', '母婴用品', '宠物用品', '汽车用品', '家用电器', '玩具乐器', '珠宝配饰', '鲜花园艺'];
  const ids = new Set(catalog.map(product => product.id));
  assert.equal(ids.size, catalog.length);
  for (const category of required) {
    const products = catalog.filter(product => product.category === category);
    assert(products.length >= 3, `${category} should have at least three products`);
    assert(products.every(product => product.title && product.brand && product.price > 0 && product.currency && product.ships_to.length));
  }
  const assigned = new Set();
  for (const [category, subcategories] of Object.entries(taxonomy)) {
    for (const [subcategory, productIds] of Object.entries(subcategories)) {
      assert(productIds.length >= 1 && productIds.length <= 2, `${category}/${subcategory} should have one or two products`);
      for (const id of productIds) {
        assert(ids.has(id), `${id} must exist in catalog`);
        assert(!assigned.has(id), `${id} must belong to only one subcategory`);
        assert.equal(catalog.find(product => product.id === id).category, category, `${id} category mismatch`);
        assigned.add(id);
      }
    }
  }
  assert.equal(assigned.size, catalog.length, 'every product must have a secondary category');
});

test('budget, destination and rejection are enforced before model selection', async () => {
  const plan = { goal: 'gift', stage: 'search', budget: 150, destination: 'CN', excludes: [], tasks: ['茶点礼盒'], must_buy: ['茶点礼盒'], directions: [] };
  const eligible = filterCatalog(plan);
  assert(eligible.length > 0);
  assert(eligible.every(p => p.price <= 150 && p.ships_to.includes('CN')));
  const responses = [plan, { text: '推荐', groups: [{ name: '错误', products: [{ id: 'invented' }, { id: 'P1006' }] }, { name: '选择', products: [{ id: 'P1072' }] }] }];
  const result = await decide([{ role: 'user', content: '礼物' }], async () => responses.shift());
  assert.equal(result.groups[0].products.length, 1);
  assert.equal(result.groups[0].products[0].id, 'P1072');
  assert.equal(result.groups[0].products[0].price, 128);
});

test('explicitly reusable items are not offered as products to buy again', () => {
  const eligible = filterCatalog({ budget: null, destination: null, excludes: [], reusable: ['双肩包'], not_buy: [] });
  assert(eligible.every(product => !`${product.title} ${product.description}`.includes('双肩包')));
});

test('clarification does not invent product cards or require a second model call', async () => {
  let calls = 0;
  const result = await decide([{ role: 'user', content: '改善通勤' }], async () => {
    calls++; return { stage: 'clarify', warmth: '每天通勤，舒服一点很重要。', question: '最困扰你的是噪音还是携带不便？' };
  });
  assert.equal(calls, 1);
  assert.equal(result.groups.length, 0);
  assert(result.text.length < 80);
});

test('scene planning returns a category checklist before matching any products', async () => {
  let calls = 0;
  const result = await decide([{ role: 'user', content: '周末去海边两天，不知道要准备什么' }], async () => {
    calls++;
    return { goal: '海边两天出行', stage: 'plan', warmth: '先把出行清单列清楚。', text: '必备：换洗衣物、洗漱用品。建议补充：防晒用品。按需或条件项：泳衣或速干衣物、手机防水袋、沙滩拖鞋、衣物收纳袋。你更想优先轻装，还是把下水用品准备齐？', tasks: ['换洗衣物', '洗漱用品'], optional: ['防晒用品', '泳衣或速干衣物', '手机防水袋', '沙滩拖鞋', '衣物收纳袋'], reusable: [], must_buy: [], unknowns: ['是否下水'] };
  });
  assert.equal(calls, 1);
  assert.equal(result.plan.stage, 'plan');
  assert.deepEqual(result.groups, []);
  assert.match(result.text, /建议补充/);
  assert.match(result.text, /轻装/);
  assert.deepEqual(result.plan.reusable, []);
});

test('a plan that still has a material question is presented as clarification', async () => {
  const result = await decide([{ role: 'user', content: '第一次租房，想布置卧室' }], async () => ({
    goal: '出租屋卧室布置', stage: 'plan', warmth: '先梳理卧室必需品。',
    question: '退租时是否需要恢复原状？', text: '先确认墙面是否允许打孔。',
    tasks: ['床垫', '窗帘'], optional: ['窗帘'],
  }));
  assert.equal(result.plan.stage, 'clarify');
  assert.match(result.text, /退租时是否需要恢复原状/);
  assert.deepEqual(result.plan.optional, []);
  assert.deepEqual(result.groups, []);
});

test('non-purchasable preparation reminders stay outside the product checklist', async () => {
  const result = await decide([{ role: 'user', content: '去意大利出差一周，帮我整理行前准备' }], async () => ({
    goal: '意大利出差', stage: 'plan', text: '必备：转换插头。行前提醒：确认护照有效期。',
    tasks: ['欧标转换插头'], prep: ['确认护照有效期', '核对机票信息'], optional: [],
  }));
  assert.deepEqual(result.plan.tasks, ['欧标转换插头']);
  assert.deepEqual(result.plan.prep, ['确认护照有效期', '核对机票信息']);
  assert.deepEqual(result.groups, []);
});

test('preference feedback after checklist proceeds to product matching without re-asking', async () => {
  const responses = [
    { goal: '海边两天出行', stage: 'search', warmth: '按轻装来整理。', text: '按轻装优先，给你看一件衣物收纳候选。', preferences: ['轻装少带'], tasks: ['衣物收纳'], must_buy: [], optional: [], reusable: [], unknowns: ['是否已有收纳用品'], directions: [] },
    { text: '這款收纳袋方便分装换洗衣物。', groups: [{ name: '衣物收纳', priority: 'candidate', products: [{ id: 'P1014', reason: '六件套可分装衣物', tradeoff: '已有袋子时可以不用买' }] }] },
  ];
  const result = await decide([
    { role: 'user', content: '周末去海边两天，主要拍照可能下水' },
    { role: 'assistant', content: '必备清单：换洗衣物、防晒用品。建议补充：泳衣、手机防水袋。按需准备：沙滩拖鞋。你优先轻装还是下水准备齐？' },
    { role: 'user', content: '优先轻装，可能不下水' },
  ], async () => responses.shift());
  assert.equal(result.plan.stage, 'search');
  assert.equal(result.groups[0].priority, 'candidate');
  assert.deepEqual(result.plan.must_buy, []);
  assert.deepEqual(result.plan.reusable, []);
});

test('product selection only receives candidates relevant to the purchase slots', async () => {
  const responses = [
    { goal: '海边出行', stage: 'search', preferences: ['轻便'], tasks: ['旅行毛巾'], must_buy: ['旅行毛巾'], optional: [], reusable: [], not_buy: [], unknowns: [] },
    { text: '先补旅行毛巾。', groups: [{ name: '旅行毛巾', priority: 'candidate', products: [{ id: 'P1007', reason: '适合近水拍照', tradeoff: '厚度未提供' }] }] },
  ];
  let selectionPrompt = '';
  const result = await decide([
    { role: 'user', content: '周末去海边，可能下水' },
    { role: 'assistant', content: '清单：旅行毛巾。优先轻便还是功能齐全？' },
    { role: 'user', content: '优先轻便，旅行毛巾我没有' },
  ], async messages => {
    const response = responses.shift();
    if (response.groups) selectionPrompt = messages[0].content;
    return response;
  });
  assert.match(selectionPrompt, /旅行毛巾/);
  assert(!selectionPrompt.includes('床垫'));
  assert.equal(result.groups[0].products[0].id, 'P1007');
  assert(result.trace.candidatePool < result.trace.eligible);
});

test('an explicitly confirmed checklist advances to product matching even if the planner repeats plan stage', async () => {
  const responses = [
    { goal: '海边出行', stage: 'plan', tasks: ['旅行毛巾'], must_buy: ['旅行毛巾'], preferences: ['轻便'], budget: 300 },
    { text: '给你两款旅行毛巾对比。', groups: [{ name: '旅行毛巾', priority: 'must_buy', products: [{ id: 'P1007', reason: '速干轻薄', tradeoff: '具体厚度未提供' }] }] },
  ];
  const result = await decide([
    { role: 'user', content: '海边旅行' },
    { role: 'assistant', content: '清单：旅行毛巾。' },
    { role: 'user', content: '清单已逐项确认。明确缺少、需要购买的必备项：旅行毛巾。预算300元。优先考虑轻便。' },
  ], async () => responses.shift());
  assert.equal(result.plan.stage, 'search');
  assert.equal(result.groups[0].products[0].id, 'P1007');
});

test('shopping plan exposes task slots, reusable items and unknowns', async () => {
  const responses = [
    { goal: '周末海边出行', stage: 'search', warmth: '先把行李控制住。', question: '需要带电脑吗？', budget: 500, tasks: ['旅行茶具', '随身收纳'], reusable: ['双肩包'], unknowns: ['是否带电脑'], directions: [] },
    { text: '先补齐旅行茶具，已有双肩包不用重复买。', groups: [{ name: '旅行茶具', priority: 'must_buy', products: [{ id: 'P1006', reason: '适合场景', tradeoff: '收纳体积未提供' }] }] },
  ];
  const result = await decide([{ role: 'user', content: '周末去海边两天，家里有双肩包，预算500' }], async () => responses.shift());
  assert.deepEqual(result.plan.tasks, ['旅行茶具', '随身收纳']);
  assert.deepEqual(result.plan.reusable, ['双肩包']);
  assert.deepEqual(result.plan.unknowns, ['是否带电脑']);
  assert.equal(result.groups[0].products[0].id, 'P1006');
});

test('drops optional purchase tasks first to keep the plan within the total budget', async () => {
  const responses = [
    { goal: '短途出行', stage: 'search', warmth: '先把任务列清楚。', question: '需要带电脑吗？', budget: 200, tasks: ['收纳', '轻便出行'], must_buy: ['收纳'], optional: ['轻便出行'], reusable: [], not_buy: ['新背包，已有双肩包'], unknowns: [], directions: [] },
    { text: '推荐两项', groups: [
      { name: '收纳', priority: 'must_buy', products: [{ id: 'P1001', reason: '可用', tradeoff: '容量有限' }] },
      { name: '轻便出行', priority: 'optional', products: [{ id: 'P1003', reason: '可用', tradeoff: '容量有限' }] },
    ] },
  ];
  const result = await decide([{ role: 'user', content: '短途出行预算200' }], async () => responses.shift());
  assert.deepEqual(result.groups.map(group => group.name), ['收纳']);
  assert.deepEqual(result.plan.must_buy, ['收纳']);
  assert.deepEqual(result.plan.not_buy, ['新背包，已有双肩包']);
  assert.equal(result.budget.status, 'within_budget');
  assert.equal(result.budget.minimum_total, 189);
  assert.equal(result.budget.optional_total, 0);
});

test('reports optional spend separately from the required plan total', async () => {
  const responses = [
    { goal: '露营', stage: 'search', warmth: '先满足基础照明。', budget: 300, tasks: ['主灯', '备用灯'], must_buy: ['主灯'], optional: ['备用灯'], reusable: [], not_buy: [], unknowns: [], directions: [] },
    { text: '主灯优先，备用灯按需。', groups: [
      { name: '主灯', priority: 'must_buy', products: [{ id: 'P1008', reason: '基础照明候选', tradeoff: '续航未核实' }] },
      { name: '备用灯', priority: 'optional', products: [{ id: 'P1038', reason: '夜间活动较多时备用', tradeoff: '不影响基础照明任务' }] },
    ] },
  ];
  const result = await decide([{ role: 'user', content: '露营灯预算300' }], async () => responses.shift());
  assert.equal(result.budget.minimum_total, 89);
  assert.equal(result.budget.optional_total, 45);
});
