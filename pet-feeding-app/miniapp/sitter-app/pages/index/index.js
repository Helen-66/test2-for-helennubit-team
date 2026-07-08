const request = require('../../utils/request');

Page({
  data: {
    sitterInfo: null,
    isOnline: false,
    pendingOrders: [],
    activeOrders: [],
    statusMap: { 1: '待接单', 2: '已接单', 3: '服务中', 4: '已完成', 5: '已取消', 6: '已拒单' },
  },

  onShow() {
    this.loadData();
  },

  async loadData() {
    try {
      const [sitterInfo, pendingOrders, activeOrders] = await Promise.all([
        request.get('/sitter/info'),
        request.get('/order/sitter/pending'),
        request.get('/order/sitter/list?status=2'),
      ]);
      this.setData({
        sitterInfo,
        isOnline: sitterInfo?.isOnline || false,
        pendingOrders,
        activeOrders,
      });
    } catch (e) {
      console.error(e);
    }
  },

  async toggleOnline() {
    const isOnline = !this.data.isOnline;
    await request.post('/sitter/online', { isOnline });
    this.setData({ isOnline });
    wx.showToast({ title: isOnline ? '已上线' : '已下线', icon: 'none' });
  },

  async acceptOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认接单',
      content: '确定要接受该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          await request.post('/order/sitter/accept', { orderId });
          wx.showToast({ title: '接单成功' });
          this.loadData();
        }
      },
    });
  },

  async rejectOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '拒绝订单',
      editable: true,
      placeholderText: '请输入拒单原因',
      success: async (res) => {
        if (res.confirm) {
          await request.post('/order/sitter/reject', { orderId, reason: res.content || '时间冲突' });
          wx.showToast({ title: '已拒单' });
          this.loadData();
        }
      },
    });
  },

  async signIn(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.getLocation({
      type: 'gcj02',
      success: async (loc) => {
        try {
          await request.post('/order/sitter/signin', { orderId, longitude: loc.longitude, latitude: loc.latitude });
          wx.showToast({ title: '签到成功' });
          this.loadData();
        } catch (err) {
          // 距离太远等错误在request中已处理
        }
      },
      fail: () => {
        wx.showToast({ title: '请授权定位', icon: 'none' });
      },
    });
  },

  async completeOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '完成服务',
      content: '确认已完成本次服务？',
      success: async (res) => {
        if (res.confirm) {
          await request.post('/order/sitter/complete', { orderId });
          wx.showToast({ title: '服务已完成' });
          this.loadData();
        }
      },
    });
  },

  goToDetail(e) {
    wx.navigateTo({ url: `/pages/order-detail/index?id=${e.currentTarget.dataset.id}` });
  },
});
