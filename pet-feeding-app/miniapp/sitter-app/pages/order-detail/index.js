const request = require('../../utils/request');

Page({
  data: {
    order: null,
    statusMap: { 0: '待支付', 1: '待接单', 2: '已接单', 3: '服务中', 4: '已完成', 5: '已取消', 6: '已拒单' },
  },

  onLoad(options) {
    this.loadDetail(options.id);
  },

  async loadDetail(id) {
    const order = await request.get(`/order/detail?id=${id}`);
    this.setData({ order });
  },
});
