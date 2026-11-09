export const addMoney = (a, b) =>
  Math.round((a + b + Number.EPSILON) * 100) / 100
