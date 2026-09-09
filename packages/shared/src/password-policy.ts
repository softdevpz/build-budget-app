// A plain string, not a RegExp object — that's what lets both sides consume
// it identically: the backend wraps it in `new RegExp(...)` for
// class-validator's @Matches, the frontend passes it straight into an HTML
// <input pattern="..."> attribute.
export const PASSWORD_POLICY_PATTERN = '(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}';

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters and include a number and a special character';
