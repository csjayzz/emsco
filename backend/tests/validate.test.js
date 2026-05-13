/**
 * Unit tests for the validation middleware.
 * Tests all supported rules: required, email, min, max, in.
 */
const validate = require('../middleware/validate');

// Helper to simulate Express req/res/next
function createMockContext(body) {
  const req = { body };
  const res = {
    _status: null,
    _json: null,
    status(code) { this._status = code; return this; },
    json(data) { this._json = data; return this; }
  };
  const next = jest.fn();
  return { req, res, next };
}

// =====================================================================
// Rule: required
// =====================================================================
describe('validate — required rule', () => {
  test('passes when field is present', () => {
    const middleware = validate({ name: 'required' });
    const { req, res, next } = createMockContext({ name: 'John' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('fails when field is missing', () => {
    const middleware = validate({ name: 'required' });
    const { req, res, next } = createMockContext({});
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
    expect(res._json.errors).toContain('name is required');
  });

  test('fails when field is empty string', () => {
    const middleware = validate({ name: 'required' });
    const { req, res, next } = createMockContext({ name: '' });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(400);
  });

  test('fails when field is null', () => {
    const middleware = validate({ name: 'required' });
    const { req, res, next } = createMockContext({ name: null });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
});

// =====================================================================
// Rule: email
// =====================================================================
describe('validate — email rule', () => {
  test('passes for valid email', () => {
    const middleware = validate({ email: 'email' });
    const { req, res, next } = createMockContext({ email: 'user@example.com' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('fails for invalid email', () => {
    const middleware = validate({ email: 'required|email' });
    const { req, res, next } = createMockContext({ email: 'not-an-email' });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._json.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('valid email')])
    );
  });

  test('skips email check when field is absent and not required', () => {
    const middleware = validate({ email: 'email' });
    const { req, res, next } = createMockContext({});
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// =====================================================================
// Rule: min
// =====================================================================
describe('validate — min rule', () => {
  test('passes when string length >= min', () => {
    const middleware = validate({ password: 'min:6' });
    const { req, res, next } = createMockContext({ password: 'abcdef' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('fails when string length < min', () => {
    const middleware = validate({ password: 'required|min:6' });
    const { req, res, next } = createMockContext({ password: 'abc' });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._json.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('at least 6')])
    );
  });

  test('works with numeric values', () => {
    const middleware = validate({ age: 'min:1' });
    const { req, res, next } = createMockContext({ age: 25 });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

// =====================================================================
// Rule: max
// =====================================================================
describe('validate — max rule', () => {
  test('passes when string length <= max', () => {
    const middleware = validate({ name: 'max:50' });
    const { req, res, next } = createMockContext({ name: 'John' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('fails when string exceeds max', () => {
    const middleware = validate({ name: 'required|max:3' });
    const { req, res, next } = createMockContext({ name: 'John' });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._json.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('at most 3')])
    );
  });
});

// =====================================================================
// Rule: in
// =====================================================================
describe('validate — in rule', () => {
  test('passes when value is in allowed list', () => {
    const middleware = validate({ role: 'in:ambulance,police' });
    const { req, res, next } = createMockContext({ role: 'ambulance' });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('fails when value is not in allowed list', () => {
    const middleware = validate({ role: 'required|in:ambulance,police' });
    const { req, res, next } = createMockContext({ role: 'admin' });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._json.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('must be one of')])
    );
  });
});

// =====================================================================
// Combined rules
// =====================================================================
describe('validate — combined rules', () => {
  test('validates multiple fields at once', () => {
    const middleware = validate({
      name: 'required',
      email: 'required|email',
      password: 'required|min:6',
      role: 'required|in:ambulance,police'
    });
    const { req, res, next } = createMockContext({
      name: 'John',
      email: 'john@example.com',
      password: 'secret123',
      role: 'ambulance'
    });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('collects multiple errors', () => {
    const middleware = validate({
      name: 'required',
      email: 'required|email',
      password: 'required|min:6'
    });
    const { req, res, next } = createMockContext({});
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._json.errors.length).toBeGreaterThanOrEqual(3);
  });
});
