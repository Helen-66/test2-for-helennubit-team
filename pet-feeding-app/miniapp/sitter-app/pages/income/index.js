const request = require('../../utils/request');

Page({
  data: {
    totalIncome: 0,
    settledIncome: 0,
    pendingIncome: 0,
    orders: [],
  },

  onShow() {
    this.loadIncome();
  },

  async loadIncome() {
    const orders = await request.get('/order/sitter/list?status=4');
    let settled = 0;
    let pending = 0;

    orders.forEach((o) => {
      const income = parseFloat(o.sitterIncome);
      if (o.settleStatus === 2) settled += income;
      else pending += income;
    });

    this.setData({
      orders,
      totalIncome: (settled + pending).toFixed(2),
      settledIncome: settled.toFixed(2),
      pendingIncome: pending.toFixed(2),
    });
  },
});
