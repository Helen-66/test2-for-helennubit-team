const request = require('../../utils/request');

Page({
  data: {
    sitter: null,
    reviews: [],
  },

  onLoad(options) {
    this.loadDetail(options.id);
  },

  async loadDetail(id) {
    const sitter = await request.get(`/sitter/detail?id=${id}`);
    this.setData({ sitter, reviews: sitter.reviews || [] });
  },

  goToOrder() {
    const { sitter } = this.data;
    wx.navigateTo({ url: `/pages/order-create/index?sitterId=${sitter.id}` });
  },
});
