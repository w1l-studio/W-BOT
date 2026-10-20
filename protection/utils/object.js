'use strict';

function clone(value) {
  return structuredClone(value);
}

function mergeDefaults(source, defaults) {
  if (Array.isArray(defaults)) return Array.isArray(source) ? source : [...defaults];
  if (!defaults || typeof defaults !== 'object') return source === undefined ? defaults : source;
  const result = {};
  for (const key of Object.keys(defaults)) {
    result[key] = mergeDefaults(source && source[key] !== undefined ? source[key] : undefined, defaults[key]);
  }
  if (source && typeof source === 'object') {
    for (const [key, value] of Object.entries(source)) {
      if (!(key in result)) result[key] = value;
    }
  }
  return result;
}

module.exports = { clone, mergeDefaults };
