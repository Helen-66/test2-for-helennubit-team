const app = getApp();
const request = require('../../utils/request');

Page({
  data: {
    userInfo: null,
    sitterInfo: null,
    isLogged: false,
  },

  onShow() {
    const token = wx.getStorageSync('sitter_token');
    if (token) {
      this.setData({ isLogged: true });
      this.loadInfo();
    }
  },

  async login() {
    const { code } = await wx.login();
    const res = await request.post('/user/login', { code });
    wx.setStorageSync('sitter_token', res.token);
    app.globalData.token = res.token;
    this.setData({ isLogged: true, userInfo: res.user });
    this.loadSitterInfo();
  },

  async loadInfo() {
    const [userInfo, sitterInfo] = await Promise.all([
      request.get('/user/info'),
      request.get('/sitter/info').catch(() => null),
    ]);
    this.setData({ userInfo, sitterInfo });
  },

  async loadSitterInfo() {
    const sitterInfo = await request.get('/sitter/info').catch(() => null);
    this.setData({ sitterInfo });
  },

  goToApply() {
    wx.navigateTo({ url: '/pages/apply/index' });
  },

  logout() {
    wx.removeStorageSync('sitter_token');
    app.globalData.token = '';
    this.setData({ isLogged: false, userInfo: null, sitterInfo: null });
  },
});
