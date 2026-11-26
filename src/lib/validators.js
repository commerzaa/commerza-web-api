'use strict';

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());

function checkText(val, label, { required = false, min = 0, max = 255 } = {}) {
  const s = str(val);
  if (!s) {
    return required ? `${label} is required` : null;
  }
  if (min > 0 && s.length < min) return `${label} must be at least ${min} characters`;
  if (s.length > max) return `${label} must be ${max} characters or fewer`;
  return null;
}

function checkEmail(val, { required = true, max = 120 } = {}) {
  const s = str(val).toLowerCase();
  if (!s) return required ? 'Email is required' : null;
  if (s.length > max) return `Email must be ${max} characters or fewer`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return 'Please enter a valid email address';
  return null;
}

function checkPhone(val, { required = true } = {}) {
  const s = str(val).replace(/[\s\-+]/g, '');
  if (!s) return required ? 'Phone number is required' : null;
  if (!/^\d{10,15}$/.test(s)) return 'Phone number must be 10 to 15 digits';
  return null;
}

function checkPincode(val, { required = false } = {}) {
  const s = str(val);
  if (!s) return required ? 'Pincode is required' : null;
  if (!/^\d{6}$/.test(s)) return 'Pincode must be a 6-digit number';
  return null;
}

function checkNumber(val, label, { required = true, min = -Infinity, max = Infinity } = {}) {
  if (val === undefined || val === null || val === '') {
    return required ? `${label} is required` : null;
  }
  const n = Number(val);
  if (!Number.isFinite(n)) return `${label} must be a valid number`;
  if (n < min) return `${label} must be at least ${min}`;
  if (n > max) return `${label} must be at most ${max}`;
  return null;
}

function checkPassword(val, { required = true, min = 6, max = 64 } = {}) {
  const s = String(val || '');
  if (!s) return required ? 'Password is required' : null;
  if (s.length < min) return `Password must be at least ${min} characters`;
  if (s.length > max) return `Password must be ${max} characters or fewer`;
  return null;
}

function checkOptionalRegex(val, label, regex, hint) {
  const s = str(val).toUpperCase();
  if (!s) return null;
  if (!regex.test(s)) return `${label} is invalid${hint ? ` (${hint})` : ''}`;
  return null;
}

function firstError(checks) {
  for (const err of checks) {
    if (err) return err;
  }
  return null;
}

module.exports = {
  str,
  checkText,
  checkEmail,
  checkPhone,
  checkPincode,
  checkNumber,
  checkPassword,
  checkOptionalRegex,
  firstError,
};
