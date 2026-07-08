const request = require('../../utils/request');

Page({
  data: {
    orders: [],
    statusMap: { 0: '待支付', 1: '待接单', 2: '已接单', 3: '服务中', 4: '已完成', 5: '已取消', 6: '已拒单' },
    currentTab: -1,
    tabs: [
      { label: '全部', value: -1 },
      { label: '待接单', value: 1 },
      { label: '进行中', value: 3 },
      { label: '已完成', value: 4 },
    ],
  },

  onShow() {
    this.loadOrders();
  },

  onTabChange(e) {
    this.setData({ currentTab: e.currentTarget.dataset.value });
    this.loadOrders();
  },

  async loadOrders() {
    const { currentTab } = this.data;
    const url = currentTab === -1 ? '/order/list' : `/order/list?status=${currentTab}`;
    const orders = await request.get(url);
    this.setData({ orders });
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/order-list/index?id=${e.currentTarget.dataset.id}` });
  },

  async cancelOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认取消',
      content: '确定要取消该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          await request.post('/order/cancel', { orderId });
          wx.showToast({ title: '已取消' });
          this.loadOrders();
        }
      },
    });
  },
});
