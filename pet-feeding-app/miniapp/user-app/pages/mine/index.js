const app = getApp();
const request = require('../../utils/request');

Page({
  data: {
    userInfo: null,
    isLogged: false,
  },

  onShow() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.setData({ isLogged: true });
      this.loadUserInfo();
    }
  },

  async login() {
    const { code } = await wx.login();
    const res = await request.post('/user/login', { code });
    wx.setStorageSync('token', res.token);
    app.globalData.token = res.token;
    this.setData({ isLogged: true, userInfo: res.user });
  },

  async loadUserInfo() {
    const info = await request.get('/user/info');
    this.setData({ userInfo: info });
  },

  goToPets() {
    wx.navigateTo({ url: '/pages/pet-manage/index' });
  },

  goToSitterApply() {
    wx.navigateTo({ url: '/pages/sitter-apply/index' });
  },

  logout() {
    wx.removeStorageSync('token');
    app.globalData.token = '';
    this.setData({ isLogged: false, userInfo: null });
  },
});
