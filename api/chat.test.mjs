import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, filterCatalog } from './chat.mjs';

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
