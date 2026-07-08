const request = require('../../utils/request');

Page({
  data: {
    sitters: [],
    loading: true,
    location: null,
  },

  onLoad() {
    this.getLocation();
  },

  onPullDownRefresh() {
    this.getLocation();
  },

  getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ location: { lng: res.longitude, lat: res.latitude } });
        this.loadNearbySitters(res.longitude, res.latitude);
      },
      fail: () => {
        wx.showToast({ title: '请授权定位权限', icon: 'none' });
        this.setData({ loading: false });
      },
    });
  },

  async loadNearbySitters(lng, lat) {
    try {
      const sitters = await request.get(`/sitter/nearby?lng=${lng}&lat=${lat}&radius=3000`);
      this.setData({ sitters, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
    wx.stopPullDownRefresh();
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/sitter-detail/index?id=${id}` });
  },
});
