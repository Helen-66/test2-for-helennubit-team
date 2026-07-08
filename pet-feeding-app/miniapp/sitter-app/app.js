App({
  globalData: {
    userInfo: null,
    token: '',
    baseUrl: 'https://your-domain.com/api',
  },
  onLaunch() {
    const token = wx.getStorageSync('sitter_token');
    if (token) {
      this.globalData.token = token;
    }
  },
});
