// Simple test to verify Jest setup works
describe('Jest Setup', () => {
  it('should run tests successfully', () => {
    expect(true).toBe(true);
  });

  it('should have access to jest globals', () => {
    expect(jest).toBeDefined();
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });
});
