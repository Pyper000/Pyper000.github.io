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
  const plan = { goal: 'gift', stage: 'search', budget: 100, destination: 'CN', excludes: ['茶具'], directions: [] };
  const eligible = filterCatalog(plan);
  assert(eligible.length > 0);
  assert(eligible.every(p => p.price <= 100 && p.ships_to.includes('CN') && !p.title.includes('茶具')));
  const responses = [plan, { text: '推荐', groups: [{ name: '错误', products: [{ id: 'invented' }, { id: 'P1006' }] }, { name: '选择', products: [{ id: eligible[0].id }] }] }];
  const result = await decide([{ role: 'user', content: '礼物' }], async () => responses.shift());
  assert.equal(result.groups[0].products.length, 1);
  assert.equal(result.groups[0].products[0].id, eligible[0].id);
  assert.equal(result.groups[0].products[0].price, eligible[0].price);
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
