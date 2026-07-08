App({
  globalData: {
    userInfo: null,
    token: '',
    baseUrl: 'https://your-domain.com/api',
  },
  onLaunch() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.token = token;
    }
  },
});
