import { formTokens, labelStyle, fieldIdle } from '../form/formTokens';

describe('C034 form chrome tokens (C033 v2)', () => {
  it('uses quiet fill with no idle border color', () => {
    expect(fieldIdle.backgroundColor).toBe('rgba(255,255,255,0.04)');
    expect(fieldIdle.borderColor).toBe('transparent');
    expect(fieldIdle.borderRadius).toBe(14);
    expect(fieldIdle.minHeight).toBe(52);
  });

  it('uses sentence-case label weight (not uppercase finance captions)', () => {
    expect(labelStyle.fontSize).toBe(13);
    expect(labelStyle.fontWeight).toBe('500');
    expect(labelStyle.color).toBe('#94a3b8');
  });

  it('uses pill CTA radius and 28px sheet radius', () => {
    expect(formTokens.radiusPill).toBe(9999);
    expect(formTokens.radiusSheet).toBe(28);
    expect(formTokens.primary).toBe('#7c3aed');
  });
});
