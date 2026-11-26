import { expect, it } from 'vitest'
import { buildStackingTree, defaults, diagnoseSticky, diagnoseZIndex, fix, logic, paintOrder, scenarios } from './logic'

it('keeps descendants inside their stacking context and can raise the container', () => {
  const state = defaults()
  expect(paintOrder(buildStackingTree(state.nodes)).map(item => item.id)).toEqual(['root', 'parent', 'floating', 'cover'])
  const [issue] = diagnoseZIndex(state.nodes, state.target, state.against)
  expect(issue).toEqual({ reason: 'isolated', culprit: 'parent' })
  fix(state, issue)
  expect(diagnoseZIndex(state.nodes, state.target, state.against)[0].reason).toBe('front')
})
it('keeps size query containers separate from paint containment', () => {
  const state = scenarios.find(([id]) => id === 'stack-container')?.[1]()
  expect(state && buildStackingTree(state.nodes).map(context => context.id)).not.toContain('parent')
  expect(state && diagnoseZIndex(state.nodes, state.target, state.against)[0].reason).toBe('front')
})

it('diagnoses the scroll ancestor and fixed containing blocks', () => {
  const hidden = scenarios.find(([id]) => id === 'sticky-hidden')?.[1]()
  const fixed = scenarios.find(([id]) => id === 'fixed-transform')?.[1]()
  expect(hidden && diagnoseSticky(hidden.nodes, hidden.target)).toContainEqual({ reason: 'scrollAncestor', culprit: 'parent' })
  expect(fixed && diagnoseSticky(fixed.nodes, fixed.target)).toEqual([{ reason: 'fixedAncestor', culprit: 'parent' }])
})
it('validates all built-ins and rejects malicious node ids and parent cycles', () => {
  for (const [, create] of scenarios) expect(logic.migrate(create(), 1)).toEqual(create())
  const state = defaults()
  state.nodes[1].parentId = 'parent'
  expect(() => logic.migrate(state, 1)).toThrow()
})
